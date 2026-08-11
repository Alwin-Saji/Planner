import { Router, Request, Response } from 'express';
import {
  generatePlannerText,
  isOllamaAvailable,
} from '../services/ollama.js';
import { searchResources, SearchedResource, KNOWN_DOCS_MAP } from '../services/resourceSearch.js';

export const plannerRouter = Router();

// ---------------------------------------------------------------------------
// Helper: YouTube playlist fetcher
// ---------------------------------------------------------------------------
async function fetchPlaylistVideos(playlistUrl: string, maxItems: number = 30): Promise<Array<{
  title: string;
  url: string;
  videoId: string;
  position: number;
}>> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];

  const listMatch = playlistUrl.match(/[?&]list=([^&]+)/);
  if (!listMatch) return [];
  const playlistId = listMatch[1];

  try {
    const params = new URLSearchParams({
      part: 'snippet',
      playlistId,
      maxResults: String(Math.min(maxItems, 50)),
      key: apiKey,
    });

    const res = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${params}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return [];

    const data = await res.json() as any;
    const items = data.items || [];

    return items
      .filter((item: any) => item.snippet?.resourceId?.videoId)
      .map((item: any, idx: number) => ({
        title: (item.snippet?.title || `Video ${idx + 1}`)
          .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'"),
        url: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}&list=${playlistId}`,
        videoId: item.snippet.resourceId.videoId,
        position: item.snippet?.position ?? idx,
      }))
      .sort((a: any, b: any) => a.position - b.position);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Helper: Enforce source diversity for UI
// ---------------------------------------------------------------------------
function diversifyResources(resources: SearchedResource[], limit: number = 20): SearchedResource[] {
  const display: SearchedResource[] = [];
  const seenIds = new Set<string>();

  const add = (arr: SearchedResource[], count: number) => {
    let added = 0;
    for (const r of arr) {
      if (added >= count) break;
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id);
        display.push(r);
        added++;
      }
    }
  };

  // Guarantee up to 3 from each main non-YouTube source first to ensure diversity
  add(resources.filter(r => r.source === 'github'), 3);
  add(resources.filter(r => r.source === 'google'), 3);
  add(resources.filter(r => r.source === 'stackoverflow'), 3);
  
  // Fill the rest with the highest ranked resources (which will naturally include YouTube)
  add(resources, limit - display.length);

  return display;
}

// ---------------------------------------------------------------------------
// POST /api/ai/generate-study-plan
// Uses Ollama Planner Generator (num_predict: 2500, num_ctx: 4096) to produce complete, non-truncated day-by-day JSON plans.
// ---------------------------------------------------------------------------
plannerRouter.post('/generate-study-plan', async (req: Request, res: Response) => {
  try {
    const {
      topic,
      category = 'Study',
      startDate,
      durationDays = 7,
      hoursPerDay = 2,
      referenceUrl = '',
      selectedChannels = [],
      model,
      learningContext = '',
    } = req.body;

    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({ error: 'Topic is required' });
    }

    const start = startDate ? new Date(startDate) : new Date();
    const days = Math.min(Math.max(Number(durationDays) || 7, 1), 30);
    const cat = (category || 'Study').trim();
    const refUrl = (referenceUrl || '').trim();

    const selectedChanObj =
      Array.isArray(selectedChannels) && selectedChannels.length > 0 ? selectedChannels[0] : null;
    const primaryChannel = selectedChanObj
      ? typeof selectedChanObj === 'string'
        ? selectedChanObj
        : selectedChanObj.name || selectedChanObj.handle || 'YouTube Tutorial'
      : 'YouTube Tutorial';
    const channelUrl =
      selectedChanObj && typeof selectedChanObj === 'object' && selectedChanObj.url
        ? selectedChanObj.url
        : `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + ' tutorial')}`;

    const { available, model: activeModel } = await isOllamaAvailable();
    const chosenModel = model || activeModel;

    const channelHandle = selectedChanObj && typeof selectedChanObj === 'object' && selectedChanObj.handle && selectedChanObj.handle.startsWith('@')
      ? selectedChanObj.handle
      : '';
    const channelNameClean = selectedChanObj && typeof selectedChanObj === 'object'
      ? (selectedChanObj.name || '').replace(/Custom:|\(.*\)/g, '').trim()
      : (typeof selectedChanObj === 'string' ? selectedChanObj : '');

    const resourceSearchPromise = searchResources({
      topic: topic,
      skillLevel: req.body.skillLevel,
      learningGoal: req.body.learningGoal,
      learningContext: [channelHandle || channelNameClean, learningContext || req.body.learningContext || ''].filter(Boolean).join(' '),
      maxPerSource: 8,
      model: chosenModel,
    }).catch(err => {
      console.warn('Resource search failed (non-blocking):', err);
      return { resources: [] as SearchedResource[], searchQueries: [] as string[], sourceCounts: {} as Record<string, number>, disambiguation: { canonical: topic, fullName: topic, context: topic, isAmbiguous: false } };
    });

    // Detect channels that have an actual playlist URL (?list= or /playlists)
    // Note: We also try any YouTube URL that might embed a playlist ID.
    const playlistChannels = (Array.isArray(selectedChannels) ? selectedChannels : [])
      .filter((ch: any) => {
        const url = typeof ch === 'string' ? ch : (ch?.playlistUrl || ch?.url || '');
        return url.includes('?list=') || url.includes('&list=') || url.includes('/playlists');
      });

    // We always request enough videos to cover all blocks in the plan
    const neededVideos = days * (hoursPerDay > 1.5 ? 2 : 1) + 3;
    const playlistVideoPromises = playlistChannels.slice(0, 2).map((ch: any) => {
      const url = typeof ch === 'string' ? ch : (ch?.url || '');
      return fetchPlaylistVideos(url, neededVideos);
    });
    const playlistResults = await Promise.all(playlistVideoPromises);
    const playlistVideos = playlistResults.flat();

    const channelSummary = (Array.isArray(selectedChannels) ? selectedChannels : [])
      .slice(0, 4)
      .map((ch: any, idx: number) => {
        const name = typeof ch === 'string' ? ch : (ch?.name || ch?.handle || `Channel ${idx + 1}`);
        const handle = typeof ch === 'string' ? '' : (ch?.handle || '');
        return `${idx + 1}. ${name}${handle ? ` (${handle})` : ''}`;
      })
      .join('\n');

    if (available) {
      const channelSection = channelSummary
        ? `\n\nThe user has selected these YouTube channels as their PRIMARY learning source:\n${channelSummary}\nFor each day's resourceUrl, prefer search URLs within these specific channels.`
        : '';

      const skillLevelStr = req.body.skillLevel || 'beginner';
      const skillInstruction = skillLevelStr === 'beginner'
        ? `\nCRITICAL FOR BEGINNER LEVEL: Each day MUST cover completely NEW and DISTINCT subtopics. NEVER repeat basic introductory concepts after Day 1.`
        : `\nTailor the depth to ${skillLevelStr} level learners.`;

      const planPrompt = `You are an expert study coach and curriculum designer. Create a detailed, non-repetitive ${days}-day study plan for learning "${topic}".

Requirements:
- Each day MUST have specific, highly curated session titles and distinct subtopics relevant to "${topic}".${skillInstruction}
- Progressive learning curve from foundational concepts to building real projects across all ${days} days.
- Tailor to approximately ${hoursPerDay} hour(s) of study per day.${channelSection}

Return ONLY a valid JSON array with NO extra text, markdown, or code fences. Format:
[
  {
    "day": 1,
    "date": "${start.toISOString().split('T')[0]}",
    "morning": {
      "title": "Specific, actionable session title for ${topic}",
      "subtopics": ["subtopic 1", "subtopic 2", "subtopic 3"],
      "notes": "Concrete study tips and key concepts to focus on",
      "resourceUrl": "https://actual-resource-url.com"
    },
    "afternoon": {
      "title": "Hands-on implementation/project title for ${topic}",
      "subtopics": ["hands-on task 1", "hands-on task 2"],
      "notes": "What to build or practice, expected outcome",
      "resourceUrl": "https://actual-resource-url.com"
    }
  }
]

Generate all ${days} days. The afternoon block is ${hoursPerDay <= 1.5 ? 'optional, skip it (set afternoon to null)' : 'required'}.`;

      // Uses generatePlannerText tailored specifically for Study Planning (num_predict: 2500, num_ctx: 4096)
      const { text: rawPlan, offline } = await generatePlannerText(planPrompt, chosenModel);

      if (!offline) {
        // ---------------------------------------------------------------------------
        // Parse + Repair/Retry: if JSON.parse fails (common for long 30-day plans
        // that get truncated), re-prompt Ollama to complete / fix the response
        // rather than silently falling through to the offline template.
        // ---------------------------------------------------------------------------
        let planDays: any[] | null = null;
        let rawPlanText = rawPlan;

        const tryParse = (text: string): any[] | null => {
          const match = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
          if (!match) return null;
          try {
            const sanitized = match[0].replace(/,\s*([\]}])/g, '$1');
            const parsed = JSON.parse(sanitized);
            return Array.isArray(parsed) ? parsed : null;
          } catch {
            return null;
          }
        };

        planDays = tryParse(rawPlanText);

        // If parse failed, attempt one JSON repair/continuation prompt
        if (!planDays) {
          console.warn('[Planner] Initial JSON parse failed. Attempting repair prompt...');
          const repairPrompt = `The following is an incomplete or malformed JSON study plan array. Fix or complete it so it is valid JSON. Return ONLY the corrected JSON array with no extra text:\n\n${rawPlanText.substring(0, 3000)}`;
          try {
            const { text: repairedText, offline: repairOffline } = await generatePlannerText(repairPrompt, chosenModel);
            if (!repairOffline) {
              planDays = tryParse(repairedText);
              if (planDays) {
                rawPlanText = repairedText;
                console.log(`[Planner] JSON repair successful — recovered ${planDays.length} days.`);
              } else {
                console.warn('[Planner] JSON repair attempt also failed. Falling back to offline template.');
              }
            }
          } catch (repairErr) {
            console.warn('[Planner] JSON repair prompt failed:', repairErr);
          }
        }

        if (planDays) {
          try {
            const searchResult = await resourceSearchPromise;
            const searchedResources = searchResult.resources || [];

            const generatedBlocks: any[] = [];
            const generatedResources: any[] = [];

            const channelSelected = Array.isArray(selectedChannels) && selectedChannels.length > 0;
            const primaryChannelTerm = (channelHandle || channelNameClean).toLowerCase().replace('@', '').trim();

            // Supplementary resources are always non-YouTube (docs, GitHub, StackOverflow)
            const supplementaryResources = searchedResources.filter(r => r.source !== 'youtube');

            type VideoItem = { title: string; url: string; isPlaylist?: boolean };

            // Build primaryPool with strict channel fidelity:
            // 1. Playlist videos (fetched directly from the selected playlist) — highest priority
            // 2. YouTube videos from the search that match the selected channel name/handle
            // 3. Only if NO channel was selected at all, use all YouTube search results
            // NEVER mix in unrelated YouTube results when a specific channel/playlist is selected.
            const primaryPool: VideoItem[] = (() => {
              if (playlistVideos.length > 0) {
                // Playlist videos were successfully fetched — use exclusively
                console.log(`[Planner] primaryPool: using ${playlistVideos.length} playlist videos from selected channel.`);
                return playlistVideos.map(v => ({ title: v.title, url: v.url, isPlaylist: true }));
              }

              if (channelSelected && primaryChannelTerm.length > 2) {
                // Channel selected — only include YouTube results that match this channel
                const channelVideos = searchedResources.filter(r =>
                  r.source === 'youtube' &&
                  (
                    (r.metadata?.channel || '').toLowerCase().includes(primaryChannelTerm) ||
                    r.title.toLowerCase().includes(primaryChannelTerm)
                  )
                );
                if (channelVideos.length > 0) {
                  console.log(`[Planner] primaryPool: ${channelVideos.length} YouTube videos matched channel "${primaryChannelTerm}".`);
                  return channelVideos.map(r => ({ title: r.title, url: r.url, isPlaylist: false }));
                }
                // Channel selected but no matching videos found in search results.
                // Return empty pool — blocks will use channelUrl as their link (correct channel at least).
                console.log(`[Planner] primaryPool: no matching channel videos found for "${primaryChannelTerm}", pool empty (blocks will use channelUrl).`);
                return [];
              }

              if (!channelSelected) {
                // No channel selected — use all YouTube results from search
                return searchedResources.filter(r => r.source === 'youtube').map(r => ({ title: r.title, url: r.url, isPlaylist: false }));
              }

              // Channel selected but term too short to filter reliably — return empty pool
              return [];
            })();

            let primaryIdx = 0;
            let suppIdx = 0;

            planDays.forEach((dayPlan: any) => {
              const dateStr = dayPlan.date || (() => {
                const d = new Date(start);
                d.setDate(start.getDate() + (dayPlan.day - 1));
                return d.toISOString().split('T')[0];
              })();

              const pickPrimaryVideo = (): VideoItem | null => {
                if (primaryPool.length === 0) return null;
                // Always cycle within the same pool — never escape to other sources
                return primaryPool[primaryIdx++ % primaryPool.length];
              };

              const pickSupplementary = (): SearchedResource | null => {
                if (supplementaryResources.length === 0) return null;
                return supplementaryResources[suppIdx++ % supplementaryResources.length];
              };

              if (dayPlan.morning) {
                const primaryVideo = pickPrimaryVideo();
                // When a channel is selected, never use the LLM-generated resourceUrl
                // (it may be hallucinated or from a different channel). Fall back to channelUrl instead.
                const blockLink = primaryVideo?.url || (channelSelected ? channelUrl : dayPlan.morning.resourceUrl) || channelUrl;
                const suppResource = pickSupplementary();

                const noteParts = [
                  dayPlan.morning.notes || '',
                  dayPlan.morning.subtopics?.length
                    ? `📌 Subtopics:\n${dayPlan.morning.subtopics.map((s: string) => `• ${s}`).join('\n')}`
                    : '',
                ];

                if (primaryVideo) {
                  const label = primaryVideo.isPlaylist ? '🎬 Playlist Video' : '🎬 YouTube';
                  noteParts.push(`${label}: ${primaryVideo.title}\n🔗 ${primaryVideo.url}`);
                } else if (dayPlan.morning.resourceUrl) {
                  noteParts.push(`🔗 Resource: ${dayPlan.morning.resourceUrl}`);
                }

                const suppResourcesToAttach = supplementaryResources.slice((dayPlan.day - 1) * 2, dayPlan.day * 2);
                suppResourcesToAttach.forEach(supp => {
                  const suppLabel = { github: '💻 GitHub Repo', google: '📄 Official Docs', stackoverflow: '💡 Stack Overflow', local: '📝 Notes', youtube: '🎬 YouTube' }[supp.source] || '🔗 Reference';
                  let info = `${suppLabel}: ${supp.title}\n🔗 ${supp.url}`;
                  if (supp.metadata?.stars) info += ` (⭐ ${supp.metadata.stars.toLocaleString()} stars)`;
                  noteParts.push(info);
                });

                generatedBlocks.push({
                  id: `block-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
                  title: dayPlan.morning.title,
                  date: dateStr,
                  start_time: '09:00',
                  end_time: '10:30',
                  category: cat,
                  status: 'planned',
                  custom_link: blockLink,
                  notes: noteParts.filter(Boolean).join('\n\n'),
                });

                if (blockLink) {
                  const isYt = blockLink.includes('youtube.com') || blockLink.includes('youtu.be');
                  generatedResources.push({
                    title: primaryVideo ? primaryVideo.title : `Day ${dayPlan.day} — ${dayPlan.morning.title}`,
                    type: isYt ? 'youtube' : 'link',
                    url_or_content: blockLink,
                    tags: JSON.stringify([cat, 'Study Plan', primaryVideo?.isPlaylist ? 'playlist' : 'youtube']),
                  });
                }
              }

              if (dayPlan.afternoon && hoursPerDay > 1.5) {
                const primaryVideo = pickPrimaryVideo();
                // Same channel-lock for afternoon blocks
                const blockLink = primaryVideo?.url || (channelSelected ? channelUrl : dayPlan.afternoon.resourceUrl) || channelUrl;
                const suppResource = pickSupplementary();

                const noteParts = [
                  dayPlan.afternoon.notes || '',
                  dayPlan.afternoon.subtopics?.length
                    ? `📌 Subtopics:\n${dayPlan.afternoon.subtopics.map((s: string) => `• ${s}`).join('\n')}`
                    : '',
                ];

                if (primaryVideo) {
                  const label = primaryVideo.isPlaylist ? '🎬 Playlist Video' : '🎬 YouTube';
                  noteParts.push(`${label}: ${primaryVideo.title}\n🔗 ${primaryVideo.url}`);
                } else if (dayPlan.afternoon.resourceUrl) {
                  noteParts.push(`🔗 Resource: ${dayPlan.afternoon.resourceUrl}`);
                }

                if (suppResource) {
                  const suppLabel = { github: '💻 GitHub', google: '📄 Docs', stackoverflow: '💡 StackOverflow', local: '📝 Notes', youtube: '🎬' }[suppResource.source] || '🔗';
                  noteParts.push(`${suppLabel} Supplementary: ${suppResource.title}\n🔗 ${suppResource.url}`);
                }

                generatedBlocks.push({
                  id: `block-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
                  title: dayPlan.afternoon.title,
                  date: dateStr,
                  start_time: '14:00',
                  end_time: '15:30',
                  category: cat,
                  status: 'planned',
                  custom_link: blockLink,
                  notes: noteParts.filter(Boolean).join('\n\n'),
                });
              }
            });

            if (refUrl) {
              const isYt = refUrl.includes('youtube.com') || refUrl.includes('youtu.be');
              generatedResources.unshift({
                title: `${topic} - Reference Material`,
                type: isYt ? 'youtube' : 'link',
                url_or_content: refUrl,
                tags: JSON.stringify([cat, 'Study Plan']),
              });
            }

            return res.json({
              success: true,
              offline: false,
              message: `✅ AI generated ${generatedBlocks.length} schedule blocks for "${topic}" with ${searchedResources.length} real resources found.`,
              blocks: generatedBlocks,
              resources: generatedResources,
              searchedResources: diversifyResources(searchedResources, 20),
              searchMeta: {
                queries: searchResult.searchQueries,
                sourceCounts: searchResult.sourceCounts,
                totalFound: searchedResources.length,
              },
              recommendedChannels: [],
            });
          } catch (hydrateErr) {
            console.warn('[Planner] Block hydration error after successful JSON parse:', hydrateErr);
          }
        }
      }
    }

    // Offline / template fallback
    const offlineSearchResult = await resourceSearchPromise;
    const offlineSearchedResources = offlineSearchResult.resources || [];

    const { blocks: offlineBlocks, resources: offlineResources } = buildOfflineStudyPlan({
      topic,
      cat,
      start,
      days,
      hoursPerDay,
      refUrl,
      channelUrl,
      primaryChannel,
    });

    if (offlineSearchedResources.length > 0) {
      offlineBlocks.forEach((block: any, idx: number) => {
        const realRes = offlineSearchedResources[idx % offlineSearchedResources.length];
        if (realRes && realRes.url) {
          block.custom_link = realRes.url;
          const sourceLabel = { youtube: '🎬 YouTube', github: '💻 GitHub', google: '📄 Docs', stackoverflow: '💡 StackOverflow', local: '📝 Notes' }[realRes.source] || '🔗';
          block.notes = (block.notes || '') + `\n\n${sourceLabel}: ${realRes.title}\n🔗 ${realRes.url}`;
        }
      });
    }

    return res.json({
      success: true,
      offline: true,
      message: `⚠️ Offline Mode: Ollama was not available. Generated a template-based plan for "${topic}".`,
      blocks: offlineBlocks,
      resources: offlineResources,
      searchedResources: diversifyResources(offlineSearchedResources, 20),
      searchMeta: {
        queries: offlineSearchResult.searchQueries,
        sourceCounts: offlineSearchResult.sourceCounts,
        totalFound: offlineSearchedResources.length,
      },
      recommendedChannels: [],
    });
  } catch (err: any) {
    console.error('Error generating study plan:', err);
    res.status(500).json({ error: err.message || 'Failed to generate study plan' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/ai/search-resources
// ---------------------------------------------------------------------------
plannerRouter.post('/search-resources', async (req: Request, res: Response) => {
  try {
    const { topic, skillLevel, learningGoal, learningContext = '', maxPerSource = 5, sources, model } = req.body;

    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({ error: 'Topic is required' });
    }

    const result = await searchResources({
      topic: topic.trim(),
      skillLevel,
      learningGoal,
      learningContext: (learningContext || '').trim(),
      maxPerSource: Math.min(Number(maxPerSource) || 5, 10),
      sources,
      model,
    });

    res.json({
      success: true,
      resources: result.resources,
      searchQueries: result.searchQueries,
      sourceCounts: result.sourceCounts,
      totalFound: result.resources.length,
      disambiguation: result.disambiguation,
    });
  } catch (err: any) {
    console.error('Error searching resources:', err);
    res.status(500).json({ error: err.message || 'Failed to search resources' });
  }
});

// ---------------------------------------------------------------------------
// Helper: Live YouTube Channel & Playlist Searcher (Data API v3)
// ---------------------------------------------------------------------------
async function fetchLiveYouTubeChannels(
  topic: string,
  videoType: string = 'playlist'
): Promise<any[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];

  try {
    const q = videoType === 'playlist'
      ? `${topic} full course playlist`
      : `${topic} complete course tutorial`;

    const params = new URLSearchParams({
      part: 'snippet',
      q,
      type: videoType === 'playlist' ? 'playlist' : 'video',
      maxResults: '8',
      order: 'relevance',
      relevanceLanguage: 'en',
      key: apiKey,
    });

    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, {
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as any;
    const items = data.items || [];

    const realChannels: any[] = [];
    const seenChannels = new Set<string>();

    items.forEach((item: any, idx: number) => {
      const snippet = item.snippet || {};
      const channelTitle = snippet.channelTitle || '';
      const channelId = snippet.channelId || '';
      const title = (snippet.title || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      const description = (snippet.description || '').replace(/&amp;/g, '&');

      if (!channelTitle || seenChannels.has(channelTitle.toLowerCase())) return;
      seenChannels.add(channelTitle.toLowerCase());

      const isPlaylist = item.id?.kind === 'youtube#playlist';
      const playlistId = item.id?.playlistId;
      const videoId = item.id?.videoId;

      const targetUrl = isPlaylist && playlistId
        ? `https://www.youtube.com/playlist?list=${playlistId}`
        : videoId
        ? `https://www.youtube.com/watch?v=${videoId}`
        : `https://www.youtube.com/channel/${channelId}`;

      const handleStr = `@${channelTitle.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;

      realChannels.push({
        name: isPlaylist ? `${channelTitle} — ${title}` : `${channelTitle} (${topic})`,
        handle: handleStr,
        description: description || `Live YouTube ${isPlaylist ? 'playlist' : 'course'} for ${topic}.`,
        url: targetUrl,
        playlistLength: isPlaylist ? 'Verified Playlist' : 'Full Course Video',
        approxTime: isPlaylist ? 'Multi-video Series' : 'Full Course',
        selected: false,
        source: 'youtube_live',
        rank: idx + 1,
      });
    });

    return realChannels;
  } catch (err) {
    console.warn('[YouTube API] Live channel search failed:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// POST /api/ai/recommend-channels
// ---------------------------------------------------------------------------
plannerRouter.post('/recommend-channels', async (req: Request, res: Response) => {
  const { topic, skill_level, learning_goal, learning_context, specific_focus, video_type = 'playlist' } = req.body;

  if (!topic || typeof topic !== 'string') {
    return res.status(400).json({ error: 'Topic is required' });
  }

  const cleanTopic = topic.trim();

  const { disambiguateTopic } = await import('../services/resourceSearch.js');
  const dis = await disambiguateTopic(cleanTopic, learning_context || '', undefined).catch(() => ({
    canonical: cleanTopic,
    fullName: cleanTopic,
    context: cleanTopic,
    isAmbiguous: false,
  }));
  const canonicalTopic = dis.fullName || cleanTopic;

  // Run Live YouTube Search, Reddit Recommendations, and Ollama AI in parallel
  const ytLivePromise = fetchLiveYouTubeChannels(canonicalTopic, video_type);
  const redditPromise = fetchRedditRecommendations(canonicalTopic);

  let aiChannels: any[] = [];
  let ollamaOffline = false;

  try {
    const { available, model: activeModel } = await isOllamaAvailable();

    if (available) {
      const skillNote = skill_level ? `\nLearner skill level: "${skill_level}".` : '';
      const goalNote = learning_goal ? `\nLearning goal: "${learning_goal}".` : '';
      const contextNote = learning_context ? `\nWhat they want to build/achieve: "${learning_context}".` : '';
      const focusNote = specific_focus ? `\nSpecific area of focus: "${specific_focus}".` : '';
      const formatNote = video_type === 'playlist'
        ? '\nPreferred format: Multi-video PLAYLISTS or dedicated playlist series.'
        : '\nPreferred format: Single long-form full course videos (e.g. 4-12 hour bootcamps).';

      const prompt = `Recommend 6 YouTube channels or playlists for learning "${canonicalTopic}".
${dis.context}${skillNote}${goalNote}${contextNote}${focusNote}${formatNote}

Return ONLY a JSON array:
[
  {
    "name": "Channel/Playlist Name",
    "handle": "@handle",
    "description": "Short 1-sentence description",
    "url": "https://www.youtube.com/@handle",
    "playlistLength": "e.g. 15 videos",
    "approxTime": "e.g. ~8 Hours"
  }
]`;

      const { text: aiResponse, offline } = await generatePlannerText(prompt, activeModel);
      ollamaOffline = offline;

      if (!offline) {
        const jsonMatch = aiResponse.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
          try {
            let sanitized = jsonMatch[0].replace(/,\s*([\]}])/g, '$1');
            const parsed = JSON.parse(sanitized);
            if (Array.isArray(parsed) && parsed.length > 0) {
              aiChannels = parsed.map((ch: any, idx: number) => ({
                name: ch.name || `${cleanTopic} ${video_type === 'playlist' ? 'Playlist' : 'Course'} ${idx + 1}`,
                handle: ch.handle || '',
                description: ch.description || `Tutorials and courses for ${cleanTopic}.`,
                url: formatChannelUrl(ch, cleanTopic, video_type),
                playlistLength: ch.playlistLength || (video_type === 'playlist' ? 'Complete Playlist' : 'Full Course'),
                approxTime: ch.approxTime || 'Varies',
                selected: idx < 3,
                source: 'ai',
              }));
            }
          } catch (parseErr) {
            console.warn('[RecommendChannels] LLM returned invalid JSON, falling back:', parseErr);
          }
        }
      }
    } else {
      ollamaOffline = true;
    }
  } catch (err) {
    console.warn('Ollama channel recommendation failed:', err);
    ollamaOffline = true;
  }

  // Await parallel live search promises
  const ytLiveChannels = await ytLivePromise;
  const redditChannels = await redditPromise;
  const fallbackPool = buildFallbackChannels(cleanTopic);

  // Priorities: AI Ollama channels -> Live YouTube API search results -> Reddit community picks -> Fallback educator pool
  const combined = [...aiChannels, ...ytLiveChannels, ...redditChannels, ...fallbackPool];

  const seen = new Set<string>();
  const uniqueChannels = combined.filter(ch => {
    const key = (ch.handle && ch.handle !== '@search' && ch.handle.length > 2)
      ? ch.handle.toLowerCase()
      : ch.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Auto-select the top 3 channels
  uniqueChannels.forEach((ch, idx) => {
    ch.selected = idx < 3;
  });

  res.json({
    channels: uniqueChannels,
    offline: ollamaOffline,
    ...(ollamaOffline && {
      offlineMessage: '⚠️ Offline Mode: Ollama is not running. Showing live YouTube search results.',
    }),
  });
});

// ---------------------------------------------------------------------------
// POST /api/ai/parse-markdown
// ---------------------------------------------------------------------------
plannerRouter.post('/parse-markdown', async (req: Request, res: Response) => {
  try {
    const markdownContent = req.body.markdownContent || req.body.markdown_content;
    const category = req.body.category || req.body.default_category || 'General';
    const startDate = req.body.startDate || req.body.start_date;

    if (!markdownContent || typeof markdownContent !== 'string') {
      return res.status(400).json({ error: 'Markdown content string is required' });
    }

    const start = startDate ? new Date(startDate) : new Date();
    const defaultCat = (category || 'General').trim();

    const parsedBlocks: any[] = [];
    const parsedResources: any[] = [];

    const lines = markdownContent.split('\n');
    let currentDayOffset = 0;

    const timeRangeRegex = /(\d{1,2}:\d{2})\s*(?:AM|PM)?\s*[-–—]\s*(\d{1,2}:\d{2})\s*(?:AM|PM)?/i;
    const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g;
    const urlRegex = /(https?:\/\/[^\s\)]+)/g;

    let lastBlock: any = null;

    lines.forEach(line => {
      const trimmed = line.trim();

      const dayMatch = trimmed.match(/Day\s*(\d+)/i);
      if (dayMatch) {
        const dayNum = parseInt(dayMatch[1], 10);
        if (!isNaN(dayNum)) currentDayOffset = dayNum - 1;
      }

      const timeMatch = trimmed.match(timeRangeRegex);
      if (timeMatch) {
        let startTime = timeMatch[1];
        let endTime = timeMatch[2];

        if (startTime.length === 4) startTime = '0' + startTime;
        if (endTime.length === 4) endTime = '0' + endTime;

        let title = trimmed
          .replace(timeRangeRegex, '')
          .replace(/^[-*|#]+\s*/, '')
          .replace(/\|/g, '')
          .trim();

        if (!title) title = 'Study Session';

        let customLink: string | null = null;
        const linkMatch = trimmed.match(/https?:\/\/[^\s\)]+/);
        if (linkMatch) {
          customLink = linkMatch[0];
        }

        const d = new Date(start);
        d.setDate(start.getDate() + currentDayOffset);
        const dateStr = d.toISOString().split('T')[0];

        const blockObj = {
          title,
          category: defaultCat,
          date: dateStr,
          start_time: startTime,
          end_time: endTime,
          status: 'planned',
          custom_link: customLink,
          notes: '',
          links: customLink ? [customLink] : [] as string[],
        };
        parsedBlocks.push(blockObj);
        lastBlock = blockObj;
      } else {
        const linkMatch = trimmed.match(/https?:\/\/[^\s\)]+/);
        if (linkMatch) {
          const url = linkMatch[0];
          const isYt = url.includes('youtube.com') || url.includes('youtu.be');

          if (lastBlock) {
            if (!lastBlock.custom_link) {
              lastBlock.custom_link = url;
            }
            if (!lastBlock.links) {
              lastBlock.links = [];
            }
            if (!lastBlock.links.includes(url)) {
              lastBlock.links.push(url);
            }
          }

          let title = trimmed
            .replace(/Reference:\s*/i, '')
            .replace(/^[-*#\s]+/g, '')
            .replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/, '$1')
            .trim();

          if (!title || title.startsWith('http')) {
            title = isYt ? 'YouTube Video' : 'Reference Link';
          }

          parsedResources.push({
            title,
            type: isYt ? 'youtube' : 'link',
            url_or_content: url,
            tags: JSON.stringify([defaultCat, 'GPT Import']),
          });
        }
      }
    });

    const rawUrls = markdownContent.match(urlRegex) || [];
    rawUrls.forEach(url => {
      if (
        (url.includes('youtube.com') || url.includes('youtu.be')) &&
        !parsedResources.some(r => r.url_or_content === url)
      ) {
        parsedResources.push({
          title: 'YouTube Reference Video',
          type: 'youtube',
          url_or_content: url,
          tags: JSON.stringify([defaultCat, 'GPT Import']),
        });
      }
    });

    const uniqueResources = parsedResources.filter(
      (r, index, self) => index === self.findIndex(t => t.url_or_content === r.url_or_content)
    );

    res.json({
      success: true,
      parsedBlocks,
      parsedResources: uniqueResources,
      data: {
        blocks: parsedBlocks,
        resources: uniqueResources,
      },
    });
  } catch (err: any) {
    console.error('Error parsing markdown:', err);
    res.status(500).json({ error: err.message || 'Failed to parse markdown' });
  }
});

// Helpers
function formatChannelUrl(ch: any, topic: string, videoType: string = 'playlist'): string {
  const encTopic = encodeURIComponent(topic);
  if (ch.url && typeof ch.url === 'string' && ch.url.startsWith('http') && !ch.url.includes('example.com')) {
    return ch.url;
  }
  const handle = ch.handle || '';
  if (handle.startsWith('@') && handle.length > 2) {
    return videoType === 'playlist'
      ? `https://www.youtube.com/${handle}/playlists`
      : `https://www.youtube.com/results?search_query=${encodeURIComponent(handle + ' ' + topic + ' full course')}`;
  }
  return `https://www.youtube.com/results?search_query=${encTopic}+${videoType === 'playlist' ? 'playlist' : 'full+course'}`;
}

async function fetchRedditRecommendations(topic: string) {
  try {
    const searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(topic + ' best youtube channel course tutorial')}&limit=6&sort=relevance`;
    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) StudyPlannerAI/1.0' },
      signal: AbortSignal.timeout(3500),
    });

    if (!res.ok) return [];

    const data = await res.json() as any;
    const posts = data?.data?.children || [];

    const channels: any[] = [];
    const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:@[\w.-]+|c\/[\w.-]+|user\/[\w.-]+|playlist\?list=[\w.-]+)|youtu\.be\/[\w.-]+)/gi;

    posts.forEach((post: any) => {
      const p = post.data;
      if (!p) return;
      const text = `${p.title} ${p.selftext || ''}`;
      const matches = text.match(ytRegex) || [];

      matches.slice(0, 2).forEach((url: string) => {
        let fullUrl = url.startsWith('http') ? url : `https://${url}`;
        let handleMatch = fullUrl.match(/youtube\.com\/(@[\w.-]+)/);
        let name = handleMatch ? handleMatch[1] : `${topic} Community Resource`;
        let handle = handleMatch ? handleMatch[1] : '@reddit_community';

        channels.push({
          name: `Reddit Pick: ${name}`,
          handle,
          description: `Community-vetted recommendation on r/${p.subreddit} (${p.score} upvotes).`,
          url: fullUrl,
          playlistLength: 'Community Choice',
          approxTime: 'Varies',
          selected: false,
          source: 'reddit',
        });
      });
    });

    return channels.slice(0, 4);
  } catch (err) {
    console.warn('[Reddit] Search failed (non-critical):', err);
    return [];
  }
}

function buildFallbackChannels(topic: string): any[] {
  const enc = encodeURIComponent(topic);
  return [
    { name: `freeCodeCamp.org (${topic})`, handle: '@freecodecamp', description: `Full-length, ad-free bootcamp courses and tutorials on ${topic}.`, url: `https://www.youtube.com/results?search_query=freecodecamp+${enc}`, playlistLength: 'Full Bootcamp', approxTime: '~8 hrs', selected: true, source: 'fallback', rank: 1 },
    { name: `Traversy Media (${topic})`, handle: '@traversymedia', description: `Practical, project-based crash courses for ${topic}.`, url: `https://www.youtube.com/results?search_query=traversymedia+${enc}`, playlistLength: 'Crash Course Series', approxTime: '~3 hrs', selected: true, source: 'fallback', rank: 2 },
    { name: `Fireship (${topic})`, handle: '@fireship', description: `High-speed 100-second overviews and quickstart guides for ${topic}.`, url: `https://www.youtube.com/results?search_query=fireship+${enc}`, playlistLength: 'Quickstart & 100s', approxTime: '~1 hr', selected: true, source: 'fallback', rank: 3 },
    { name: `Programming with Mosh (${topic})`, handle: '@programmingwithmosh', description: `Step-by-step beginner-friendly tutorials for ${topic}.`, url: `https://www.youtube.com/results?search_query=programmingwithmosh+${enc}`, playlistLength: 'Complete Tutorial', approxTime: '~4 hrs', selected: false, source: 'fallback', rank: 4 },
    { name: `Academind (${topic})`, handle: '@academind', description: `In-depth web development and programming courses covering ${topic}.`, url: `https://www.youtube.com/results?search_query=academind+${enc}`, playlistLength: 'Deep Dive Series', approxTime: '~6 hrs', selected: false, source: 'fallback', rank: 5 },
    { name: `The Net Ninja (${topic})`, handle: '@thenetninja', description: `Bite-sized, modular playlist tutorials step-by-step on ${topic}.`, url: `https://www.youtube.com/results?search_query=thenetninja+${enc}`, playlistLength: 'Modular Playlist', approxTime: '~5 hrs', selected: false, source: 'fallback', rank: 6 },
  ];
}

const TOPIC_CURRICULUM: Record<string, Array<{ morning: string; afternoon: string; subtopics: string[] }>> = {
  'go': [
    { morning: 'Go Environment Setup, Syntax & Variables', afternoon: 'Control Structures & Functions in Go', subtopics: ['go mod init', 'pointers', 'structs'] },
    { morning: 'Data Structures: Arrays, Slices & Maps', afternoon: 'Methods, Interfaces & Type Assertions', subtopics: ['slice capacity', 'map operations', 'interface contracts'] },
    { morning: 'Goroutines & Concurrency Foundations', afternoon: 'Channels, Select Statements & Mutexes', subtopics: ['channel buffering', 'sync.WaitGroup', 'race detector'] },
  ],
};

function buildOfflineStudyPlan({
  topic,
  cat,
  start,
  days,
  hoursPerDay,
  refUrl,
  channelUrl,
  primaryChannel,
}: {
  topic: string;
  cat: string;
  start: Date;
  days: number;
  hoursPerDay: number;
  refUrl: string;
  channelUrl: string;
  primaryChannel: string;
}) {
  const encTopic = encodeURIComponent(topic.trim());
  const topicKey = topic.toLowerCase().trim();
  const curriculum = TOPIC_CURRICULUM[topicKey] || TOPIC_CURRICULUM[topicKey.split(' ')[0]];

  const generatedBlocks: any[] = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];

    const curItem = curriculum ? curriculum[i % curriculum.length] : null;
    const morningTitle = curItem ? `${topic}: ${curItem.morning}` : `${topic}: Foundations Day ${i + 1}`;
    const afternoonTitle = curItem ? `${topic}: ${curItem.afternoon}` : `${topic}: Practical Application Day ${i + 1}`;

    generatedBlocks.push({
      id: `block-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      title: morningTitle,
      date: dateStr,
      start_time: '09:00',
      end_time: '10:30',
      category: cat,
      status: 'planned',
      custom_link: channelUrl,
      notes: `📌 Key Subtopics:\n• ${topic} core concepts & exercises`,
    });

    if (hoursPerDay > 1.5) {
      generatedBlocks.push({
        id: `block-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        title: afternoonTitle,
        date: dateStr,
        start_time: '14:00',
        end_time: '15:30',
        category: cat,
        status: 'planned',
        custom_link: channelUrl,
        notes: `📌 Key Subtopics:\n• ${topic} hands-on project build`,
      });
    }
  }

  const generatedResources: any[] = [];
  if (refUrl) {
    const isYt = refUrl.includes('youtube.com') || refUrl.includes('youtu.be');
    generatedResources.push({
      title: `${topic} - Reference Material`,
      type: isYt ? 'youtube' : 'link',
      url_or_content: refUrl,
      tags: JSON.stringify([cat, 'Study Plan']),
    });
  }

  return { blocks: generatedBlocks, resources: generatedResources };
}
