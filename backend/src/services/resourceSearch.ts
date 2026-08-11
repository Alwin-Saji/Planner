/**
 * Resource Search Service — Intelligent Reasoning Engine v2
 *
 * Pipeline:
 *  1. disambiguateTopic()     — LLM-powered topic normalization & context extraction
 *  2. generateSourceQueries() — Per-source optimised search queries (not one-size-fits-all)
 *  3. Source adapters         — YouTube, GitHub (with language filter), Google CSE, StackOverflow, Local
 *  4. Deduplication           — URL-level
 *  5. rankResources()         — LLM re-rank → heuristic fallback
 *
 * When Ollama is ONLINE  → Steps 1 & 2 use real LLM reasoning (no hardcoded values)
 * When Ollama is OFFLINE → Steps 1 & 2 fall back to a disambiguation map + template queries
 */

import { db } from '../db.js';
import { generateText, isOllamaAvailable, getEmbedding, cosineSimilarity } from './ollama.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchedResource {
  id: string;
  title: string;
  url: string;
  source: 'youtube' | 'github' | 'google' | 'stackoverflow' | 'local';
  description: string;
  metadata: {
    views?: number;
    stars?: number;
    votes?: number;
    duration?: string;
    channel?: string;
    language?: string;
    tags?: string[];
    thumbnail?: string;
  };
  relevanceScore: number;
}

export interface SearchOptions {
  topic: string;
  skillLevel?: string;
  learningGoal?: string;
  learningContext?: string; // Free-text: what the user wants to build/achieve
  maxPerSource?: number;
  sources?: Array<'youtube' | 'github' | 'google' | 'stackoverflow' | 'local'>;
  model?: string;
}

/** Per-source query bundle produced by the reasoning layer */
interface SourceQueries {
  youtube: string[];   // 1–2 queries
  github: string;      // 1 query
  google: string;      // 1 query
  stackoverflow: string; // 1 query
}

/** Result of disambiguation */
interface DisambiguationResult {
  canonical: string;          // e.g. "golang"
  fullName: string;           // e.g. "Go programming language"
  context: string;            // short description used in LLM prompts
  githubLanguage?: string;    // GitHub API language filter value, e.g. "Go"
  stackoverflowTag?: string;  // SO tag, e.g. "go"
  isAmbiguous: boolean;
}

// ---------------------------------------------------------------------------
// Layer 1: Topic Disambiguation
// ---------------------------------------------------------------------------

/**
 * Hardcoded offline fallback map for common ambiguous topics.
 * Only used when Ollama is NOT available.
 */
const OFFLINE_DISAMBIGUATION_MAP: Record<string, Omit<DisambiguationResult, 'isAmbiguous'>> = {
  'go': { canonical: 'golang', fullName: 'Go programming language', context: 'Go is a statically typed, compiled language.', githubLanguage: 'Go', stackoverflowTag: 'go' },
  'golang': { canonical: 'golang', fullName: 'Go programming language', context: 'Go is a statically typed, compiled language.', githubLanguage: 'Go', stackoverflowTag: 'go' },
  'rust': { canonical: 'rust', fullName: 'Rust programming language', context: 'Rust is a systems language focused on safety.', githubLanguage: 'Rust', stackoverflowTag: 'rust' },
  'swift': { canonical: 'swift', fullName: 'Swift programming language', context: 'Swift is a compiled language for Apple platforms.', githubLanguage: 'Swift', stackoverflowTag: 'swift' },
  'c': { canonical: 'c', fullName: 'C programming language', context: 'C is a general-purpose procedural language.', githubLanguage: 'C', stackoverflowTag: 'c' },
  'c++': { canonical: 'c++', fullName: 'C++ programming language', context: 'C++ is a high-performance extension of C.', githubLanguage: 'C++', stackoverflowTag: 'c++' },
  'c#': { canonical: 'c#', fullName: 'C# programming language', context: 'C# is an object-oriented language for .NET.', githubLanguage: 'C#', stackoverflowTag: 'c#' },
  'kotlin': { canonical: 'kotlin', fullName: 'Kotlin programming language', context: 'Kotlin is a modern language for Android.', githubLanguage: 'Kotlin', stackoverflowTag: 'kotlin' },
  'java': { canonical: 'java', fullName: 'Java programming language', context: 'Java is an object-oriented, platform-independent language.', githubLanguage: 'Java', stackoverflowTag: 'java' },
  'python': { canonical: 'python', fullName: 'Python programming language', context: 'Python is a high-level interpreted language.', githubLanguage: 'Python', stackoverflowTag: 'python' },
  'js': { canonical: 'javascript', fullName: 'JavaScript', context: 'JavaScript is the core language of the web.', githubLanguage: 'JavaScript', stackoverflowTag: 'javascript' },
  'javascript': { canonical: 'javascript', fullName: 'JavaScript', context: 'JavaScript is the core language of the web.', githubLanguage: 'JavaScript', stackoverflowTag: 'javascript' },
  'ts': { canonical: 'typescript', fullName: 'TypeScript', context: 'TypeScript adds static types to JavaScript.', githubLanguage: 'TypeScript', stackoverflowTag: 'typescript' },
  'typescript': { canonical: 'typescript', fullName: 'TypeScript', context: 'TypeScript adds static types to JavaScript.', githubLanguage: 'TypeScript', stackoverflowTag: 'typescript' },
  'php': { canonical: 'php', fullName: 'PHP language', context: 'PHP is a server-side scripting language.', githubLanguage: 'PHP', stackoverflowTag: 'php' },
  'ruby': { canonical: 'ruby', fullName: 'Ruby language', context: 'Ruby is a dynamic, interpreted language.', githubLanguage: 'Ruby', stackoverflowTag: 'ruby' },
  'r': { canonical: 'r', fullName: 'R language', context: 'R is for statistical computing.', githubLanguage: 'R', stackoverflowTag: 'r' },
  'react': { canonical: 'react', fullName: 'React library', context: 'React is a library for building UI.', githubLanguage: 'TypeScript', stackoverflowTag: 'reactjs' },
  'vue': { canonical: 'vue', fullName: 'Vue.js framework', context: 'Vue is a progressive JS framework.', githubLanguage: 'JavaScript', stackoverflowTag: 'vue.js' },
  'angular': { canonical: 'angular', fullName: 'Angular framework', context: 'Angular is a platform for web apps.', githubLanguage: 'TypeScript', stackoverflowTag: 'angular' },
  'svelte': { canonical: 'svelte', fullName: 'Svelte framework', context: 'Svelte is a component-based compiler.', githubLanguage: 'JavaScript', stackoverflowTag: 'svelte' },
  'next.js': { canonical: 'next.js', fullName: 'Next.js', context: 'React framework for production.', githubLanguage: 'TypeScript', stackoverflowTag: 'next.js' },
  'express': { canonical: 'express', fullName: 'Express.js', context: 'Node.js web application framework.', githubLanguage: 'JavaScript', stackoverflowTag: 'express' },
  'django': { canonical: 'django', fullName: 'Django', context: 'High-level Python web framework.', githubLanguage: 'Python', stackoverflowTag: 'django' },
  'flask': { canonical: 'flask', fullName: 'Flask', context: 'Lightweight WSGI web application framework.', githubLanguage: 'Python', stackoverflowTag: 'flask' },
  'fastapi': { canonical: 'fastapi', fullName: 'FastAPI', context: 'Modern Python web framework for APIs.', githubLanguage: 'Python', stackoverflowTag: 'fastapi' },
  'spring': { canonical: 'spring boot', fullName: 'Spring Boot', context: 'Java-based framework for enterprise apps.', githubLanguage: 'Java', stackoverflowTag: 'spring' },
  'laravel': { canonical: 'laravel', fullName: 'Laravel', context: 'PHP web application framework.', githubLanguage: 'PHP', stackoverflowTag: 'laravel' },
  'rails': { canonical: 'ruby on rails', fullName: 'Ruby on Rails', context: 'Web framework for Ruby.', githubLanguage: 'Ruby', stackoverflowTag: 'ruby-on-rails' },
  'flutter': { canonical: 'flutter', fullName: 'Flutter', context: 'Google UI toolkit for mobile/web.', githubLanguage: 'Dart', stackoverflowTag: 'flutter' },
  'node': { canonical: 'nodejs', fullName: 'Node.js', context: 'JavaScript runtime for server-side.', githubLanguage: 'JavaScript', stackoverflowTag: 'node.js' },
  'docker': { canonical: 'docker', fullName: 'Docker', context: 'Platform for containerized apps.', githubLanguage: 'Go', stackoverflowTag: 'docker' },
  'kubernetes': { canonical: 'kubernetes', fullName: 'Kubernetes', context: 'Container orchestration system.', githubLanguage: 'Go', stackoverflowTag: 'kubernetes' },
  'terraform': { canonical: 'terraform', fullName: 'Terraform', context: 'Infrastructure as Code tool.', githubLanguage: 'HCL', stackoverflowTag: 'terraform' },
  'aws': { canonical: 'aws', fullName: 'Amazon Web Services', context: 'Cloud computing platform.', githubLanguage: 'Java', stackoverflowTag: 'amazon-web-services' },
  'azure': { canonical: 'azure', fullName: 'Microsoft Azure', context: 'Cloud computing platform.', githubLanguage: 'C#', stackoverflowTag: 'azure' },
  'gcp': { canonical: 'google cloud platform', fullName: 'Google Cloud', context: 'Cloud infrastructure services.', githubLanguage: 'Go', stackoverflowTag: 'google-cloud-platform' },
  'sql': { canonical: 'sql', fullName: 'SQL', context: 'Standard language for relational databases.', githubLanguage: 'SQL', stackoverflowTag: 'sql' },
  'postgresql': { canonical: 'postgresql', fullName: 'PostgreSQL', context: 'Relational database management system.', githubLanguage: 'PLpgSQL', stackoverflowTag: 'postgresql' },
  'mongodb': { canonical: 'mongodb', fullName: 'MongoDB', context: 'NoSQL database for modern apps.', githubLanguage: 'JavaScript', stackoverflowTag: 'mongodb' },
  'redis': { canonical: 'redis', fullName: 'Redis', context: 'In-memory data structure store.', githubLanguage: 'C', stackoverflowTag: 'redis' },
  'mysql': { canonical: 'mysql', fullName: 'MySQL', context: 'Open-source relational database.', githubLanguage: 'SQL', stackoverflowTag: 'mysql' },
  'git': { canonical: 'git', fullName: 'Git', context: 'Version control system.', githubLanguage: 'C', stackoverflowTag: 'git' },
  'linux': { canonical: 'linux', fullName: 'Linux OS', context: 'Kernel and operating system environment.', githubLanguage: 'C', stackoverflowTag: 'linux' },
  'bash': { canonical: 'bash', fullName: 'Bash scripting', context: 'Shell and command language.', githubLanguage: 'Shell', stackoverflowTag: 'bash' },
  'networking': { canonical: 'networking', fullName: 'Networking', context: 'Concepts of TCP/IP, DNS, and protocols.', githubLanguage: 'C', stackoverflowTag: 'networking' },
  'security': { canonical: 'cybersecurity', fullName: 'Cybersecurity', context: 'Protecting systems and networks.', githubLanguage: 'Python', stackoverflowTag: 'security' },
  'algorithms': { canonical: 'dsa', fullName: 'Data Structures and Algorithms', context: 'Fundamental computer science concepts.', githubLanguage: 'Java', stackoverflowTag: 'algorithm' },
  'dsa': { canonical: 'dsa', fullName: 'Data Structures and Algorithms', context: 'Fundamental computer science concepts.', githubLanguage: 'Java', stackoverflowTag: 'algorithm' },
  'ai': { canonical: 'artificial intelligence', fullName: 'Artificial Intelligence', context: 'Machine learning and cognitive computing.', githubLanguage: 'Python', stackoverflowTag: 'artificial-intelligence' },
  'ml': { canonical: 'machine learning', fullName: 'Machine Learning', context: 'Predictive modeling and data patterns.', githubLanguage: 'Python', stackoverflowTag: 'machine-learning' },
  'data science': { canonical: 'data science', fullName: 'Data Science', context: 'Analysis and interpretation of data.', githubLanguage: 'Python', stackoverflowTag: 'data-science' },
  'pandas': { canonical: 'pandas', fullName: 'Pandas', context: 'Library for data manipulation.', githubLanguage: 'Python', stackoverflowTag: 'pandas' },
  'numpy': { canonical: 'numpy', fullName: 'NumPy', context: 'Numerical computing in Python.', githubLanguage: 'Python', stackoverflowTag: 'numpy' },
  'tensorflow': { canonical: 'tensorflow', fullName: 'TensorFlow', context: 'ML framework by Google.', githubLanguage: 'Python', stackoverflowTag: 'tensorflow' },
  'pytorch': { canonical: 'pytorch', fullName: 'PyTorch', context: 'ML framework by Meta.', githubLanguage: 'Python', stackoverflowTag: 'pytorch' },
  'ui': { canonical: 'ui design', fullName: 'User Interface Design', context: 'Design of visual interfaces.', githubLanguage: 'CSS', stackoverflowTag: 'design' },
  'ux': { canonical: 'ux design', fullName: 'User Experience Design', context: 'The overall experience of product use.', githubLanguage: 'CSS', stackoverflowTag: 'ux' },
  'testing': { canonical: 'software testing', fullName: 'Software Testing', context: 'Unit, integration, and e2e testing.', githubLanguage: 'JavaScript', stackoverflowTag: 'testing' },
  'jest': { canonical: 'jest', fullName: 'Jest testing framework', context: 'Testing library for JS.', githubLanguage: 'JavaScript', stackoverflowTag: 'jestjs' },
  'cypress': { canonical: 'cypress', fullName: 'Cypress', context: 'E2E testing for web apps.', githubLanguage: 'JavaScript', stackoverflowTag: 'cypress' },
  'graphql': { canonical: 'graphql', fullName: 'GraphQL', context: 'API query language.', githubLanguage: 'JavaScript', stackoverflowTag: 'graphql' },
  'rest': { canonical: 'rest api', fullName: 'REST API', context: 'Architectural style for web services.', githubLanguage: 'JavaScript', stackoverflowTag: 'rest' },
  'html': { canonical: 'html5', fullName: 'HTML5', context: 'Standard markup language for web.', githubLanguage: 'HTML', stackoverflowTag: 'html' },
  'css': { canonical: 'css3', fullName: 'CSS3', context: 'Style sheet language for web.', githubLanguage: 'CSS', stackoverflowTag: 'css' },
  'sass': { canonical: 'sass', fullName: 'Sass', context: 'CSS preprocessor.', githubLanguage: 'SCSS', stackoverflowTag: 'sass' },
  'tailwind': { canonical: 'tailwindcss', fullName: 'Tailwind CSS', context: 'Utility-first CSS framework.', githubLanguage: 'CSS', stackoverflowTag: 'tailwind-css' },
  'bootstrap': { canonical: 'bootstrap', fullName: 'Bootstrap', context: 'Responsive front-end framework.', githubLanguage: 'CSS', stackoverflowTag: 'twitter-bootstrap' },
  'webgl': { canonical: 'webgl', fullName: 'WebGL', context: 'JavaScript API for 3D graphics.', githubLanguage: 'JavaScript', stackoverflowTag: 'webgl' },
  'opencv': { canonical: 'opencv', fullName: 'OpenCV', context: 'Computer vision library.', githubLanguage: 'C++', stackoverflowTag: 'opencv' },
  'unity': { canonical: 'unity', fullName: 'Unity', context: 'Game development engine.', githubLanguage: 'C#', stackoverflowTag: 'unity3d' },
  'unreal': { canonical: 'unreal engine', fullName: 'Unreal Engine', context: '3D game development.', githubLanguage: 'C++', stackoverflowTag: 'unreal-engine' },
  'solidity': { canonical: 'solidity', fullName: 'Solidity', context: 'Smart contract language.', githubLanguage: 'Solidity', stackoverflowTag: 'solidity' },
  'blockchain': { canonical: 'blockchain', fullName: 'Blockchain', context: 'Distributed ledger technology.', githubLanguage: 'Go', stackoverflowTag: 'blockchain' },
  'microservices': { canonical: 'microservices', fullName: 'Microservices architecture', context: 'Distributed service design.', githubLanguage: 'Go', stackoverflowTag: 'microservices' },
  'agile': { canonical: 'agile', fullName: 'Agile methodology', context: 'Software development process.', stackoverflowTag: 'agile' },
  'scrum': { canonical: 'scrum', fullName: 'Scrum', context: 'Framework for project management.', stackoverflowTag: 'scrum' },
  'devops': { canonical: 'devops', fullName: 'DevOps', context: 'Integration of software and ops.', githubLanguage: 'Shell', stackoverflowTag: 'devops' },
  'cicd': { canonical: 'ci/cd', fullName: 'Continuous Integration/Deployment', context: 'Automated software delivery.', githubLanguage: 'YAML', stackoverflowTag: 'ci-cd' },
  'linux kernel': { canonical: 'linux kernel', fullName: 'Linux Kernel', context: 'The core of Linux systems.', githubLanguage: 'C', stackoverflowTag: 'linux-kernel' },
  'assembly': { canonical: 'assembly', fullName: 'Assembly language', context: 'Low-level CPU instructions.', githubLanguage: 'Assembly', stackoverflowTag: 'assembly' },
};

/** Known official documentation pages per topic for curated direct links */
export const KNOWN_DOCS_MAP: Record<string, { title: string; url: string; description: string }[]> = {
  'go': [
    { title: 'Go Documentation (Official)', url: 'https://go.dev/doc/', description: 'Official Go language specifications, tutorials, and standard library documentation.' },
    { title: 'Go by Example', url: 'https://gobyexample.com/', description: 'Hands-on Go tutorials with annotated example programs.' },
  ],
  'golang': [
    { title: 'Go Documentation (Official)', url: 'https://go.dev/doc/', description: 'Official Go language specifications, tutorials, and standard library documentation.' },
    { title: 'Go by Example', url: 'https://gobyexample.com/', description: 'Hands-on Go tutorials with annotated example programs.' },
  ],
  'python': [
    { title: 'Python 3 Official Documentation', url: 'https://docs.python.org/3/', description: 'Official Python 3 reference manual, standard library docs, and tutorial.' },
    { title: 'Real Python Tutorials', url: 'https://realpython.com/', description: 'Python tutorials, articles, and video courses.' },
  ],
  'react': [
    { title: 'React Official Documentation', url: 'https://react.dev/', description: 'The official React documentation — quick start, hooks API, and interactive examples.' },
  ],
  'typescript': [
    { title: 'TypeScript Official Handbook', url: 'https://www.typescriptlang.org/docs/handbook/intro.html', description: 'The official TypeScript handbook for developers.' },
  ],
  'javascript': [
    { title: 'MDN JavaScript Guide', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide', description: 'Comprehensive guide to JavaScript language features on MDN.' },
  ],
  'rust': [
    { title: 'The Rust Programming Language (The Book)', url: 'https://doc.rust-lang.org/book/', description: 'The official definitive book on Rust.' },
  ],
  'docker': [
    { title: 'Docker Official Documentation', url: 'https://docs.docker.com/get-started/', description: 'Official Docker guides, reference manuals, and architecture overview.' },
  ],
  'kubernetes': [
    { title: 'Kubernetes Official Documentation', url: 'https://kubernetes.io/docs/home/', description: 'Official Kubernetes tutorials, concepts, and API reference.' },
  ],
  'dsa': [
    { title: 'GeeksforGeeks Data Structures & Algorithms', url: 'https://www.geeksforgeeks.org/data-structures/', description: 'Data structures and algorithms topic guides and code implementations.' },
  ],
};

/**
 * Layer 1: Disambiguate the user's topic.
 *
 * When Ollama is ONLINE:
 *   → Uses LLM to extract the canonical form, context, GitHub language, and SO tag from scratch.
 *     No hardcoded values — LLM does the full reasoning using internet knowledge.
 *
 * When Ollama is OFFLINE:
 *   → Falls back to the OFFLINE_DISAMBIGUATION_MAP.
 *   → If not found in the map, returns the raw topic unchanged (no hallucination).
 */
export async function disambiguateTopic(
  topic: string,
  learningContext?: string,
  model?: string
): Promise<DisambiguationResult> {
  const { available } = await isOllamaAvailable();

  if (available) {
    try {
      const contextHint = learningContext ? `\nUser's learning goal/context: "${learningContext}"` : '';

      const prompt = `You are a topic disambiguation expert for an educational search engine.

The user wants to learn: "${topic}"${contextHint}

Your task:
1. Identify the EXACT subject they want to learn (resolve any ambiguity)
2. Generate the canonical search-optimized name for it
3. Provide a short context description (1 sentence)
4. If it's a programming language or framework, provide the GitHub language name and Stack Overflow tag

IMPORTANT: Use your knowledge to determine the correct canonical form.
Examples:
- "Go language" → canonical: "golang", githubLanguage: "Go", stackoverflowTag: "go"
- "Rust" (in a programming context) → canonical: "rust programming language", githubLanguage: "Rust", stackoverflowTag: "rust"
- "Swift" → canonical: "swift programming language", githubLanguage: "Swift", stackoverflowTag: "swift"
- "Machine Learning" → canonical: "machine learning tutorial", githubLanguage: "Python", stackoverflowTag: "machine-learning"
- "DSA" → canonical: "data structures and algorithms", githubLanguage: null, stackoverflowTag: "algorithm"

Return ONLY a valid JSON object, no markdown, no extra text:
{
  "canonical": "exact search-optimized term",
  "fullName": "Full proper name of the subject",
  "context": "One sentence describing what this is",
  "githubLanguage": "GitHub API language filter value or null",
  "stackoverflowTag": "most relevant SO tag or null"
}`;

      const { text, offline } = await generateText(prompt, model);

      if (!offline) {
        const jsonMatch = text.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.canonical && parsed.fullName && parsed.context) {
            return {
              canonical: parsed.canonical,
              fullName: parsed.fullName,
              context: parsed.context,
              githubLanguage: parsed.githubLanguage || undefined,
              stackoverflowTag: parsed.stackoverflowTag || undefined,
              isAmbiguous: topic.toLowerCase() !== parsed.canonical.toLowerCase(),
            };
          }
        }
      }
    } catch (err) {
      console.warn('[ResourceSearch] LLM disambiguation failed, using offline fallback:', err);
    }
  }

  // Offline fallback: check the map
  const key = topic.trim().toLowerCase();
  const mapped = OFFLINE_DISAMBIGUATION_MAP[key];
  if (mapped) {
    return { ...mapped, isAmbiguous: true };
  }

  // No match — return raw topic (safe, no hallucination)
  return {
    canonical: topic.trim(),
    fullName: topic.trim(),
    context: topic.trim(),
    isAmbiguous: false,
  };
}

// ---------------------------------------------------------------------------
// Layer 2: Per-Source Smart Query Generation
// ---------------------------------------------------------------------------

/**
 * Layer 2: Generate source-specific search queries using LLM when online.
 *
 * Each source gets a query that fits its search semantics:
 * - YouTube: tutorial/course language that matches video titles
 * - GitHub: code repo search with language filter
 * - Google: documentation/guide search
 * - StackOverflow: question/problem language
 *
 * When Ollama is ONLINE → LLM generates the queries from the disambiguation result
 * When Ollama is OFFLINE → Template fallback using canonical term
 */
export async function generateSourceQueries(
  dis: DisambiguationResult,
  skillLevel?: string,
  learningGoal?: string,
  learningContext?: string,
  model?: string
): Promise<SourceQueries & { allQueries: string[] }> {
  const { available } = await isOllamaAvailable();

  if (available) {
    try {
      const contextLine = learningContext ? `User's specific goal: "${learningContext}".` : '';
      const skillLine = skillLevel ? `Skill level: ${skillLevel}.` : '';
      const goalLine = learningGoal ? `Learning goal: ${learningGoal}.` : '';

      const prompt = `You are a search query specialist for an educational resource engine.

Topic: "${dis.fullName}"
Context: ${dis.context}
${skillLine} ${goalLine} ${contextLine}

Generate optimized search queries for each of these 4 platforms. Each query must be tailored to how real people search on that platform for the best learning results.

Rules:
- YouTube queries: match real video tutorial titles (include words like "tutorial", "crash course", "for beginners", "full course" based on skill level)
- GitHub query: find repositories FOR LEARNING this topic (include "awesome", "examples", "tutorial", "learning", "course" — use the canonical name)
- Google query: find official docs, guides, or reputable learning articles
- StackOverflow query: find answered questions about real problems when learning this topic

Return ONLY a valid JSON object:
{
  "youtube": ["primary query", "secondary query"],
  "github": "single github query",
  "google": "single google query",
  "stackoverflow": "single stackoverflow question query"
}`;

      const { text, offline } = await generateText(prompt, model);

      if (!offline) {
        const jsonMatch = text.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.youtube && parsed.github && parsed.google && parsed.stackoverflow) {
            const ytQueries = Array.isArray(parsed.youtube) ? parsed.youtube : [parsed.youtube];
            const allQueries = [...ytQueries, parsed.github, parsed.google, parsed.stackoverflow];
            return {
              youtube: ytQueries.slice(0, 2),
              github: parsed.github,
              google: parsed.google,
              stackoverflow: parsed.stackoverflow,
              allQueries,
            };
          }
        }
      }
    } catch (err) {
      console.warn('[ResourceSearch] LLM query generation failed, using template fallback:', err);
    }
  }

  // Offline template fallback using the canonical term
  const c = dis.canonical;
  const level = skillLevel || 'beginners';
  const ytPrimary = `${c} tutorial for ${level}`;
  const ytSecondary = learningGoal === 'interview' ? `${c} interview questions` : `${c} full course`;
  const ghQuery = `${c} tutorial examples learning`;
  const googleQuery = `${c} official documentation getting started`;
  const soQuery = `${c} best practices common errors ${level}`;

  return {
    youtube: [ytPrimary, ytSecondary],
    github: ghQuery,
    google: googleQuery,
    stackoverflow: soQuery,
    allQueries: [ytPrimary, ytSecondary, ghQuery, googleQuery, soQuery],
  };
}

// ---------------------------------------------------------------------------
// Source Adapters
// ---------------------------------------------------------------------------

const ADAPTER_TIMEOUT = 5000;

/** YouTube Data API v3 */
async function searchYouTube(query: string, maxResults: number = 5): Promise<SearchedResource[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.log('YouTube API: No YOUTUBE_API_KEY configured, skipping.');
    return [];
  }

  try {
    const params = new URLSearchParams({
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults: String(maxResults),
      order: 'relevance',
      relevanceLanguage: 'en',
      // Removed videoDuration: 'medium' — was excluding full courses (>20 min)
      // We now allow any duration and boost longer educational videos in ranking
      safeSearch: 'none',
      key: apiKey,
    });

    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, {
      signal: AbortSignal.timeout(ADAPTER_TIMEOUT),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`YouTube API error (${res.status}):`, errText);
      return [];
    }

    const data = await res.json() as any;
    const items = data.items || [];

    // Fetch video statistics (view counts) in batch
    const videoIds = items.map((item: any) => item.id?.videoId).filter(Boolean);
    let statsMap: Record<string, { viewCount: number; duration: string; durationSeconds: number }> = {};

    if (videoIds.length > 0) {
      try {
        const statsParams = new URLSearchParams({
          part: 'statistics,contentDetails',
          id: videoIds.join(','),
          key: apiKey,
        });
        const statsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?${statsParams}`, {
          signal: AbortSignal.timeout(ADAPTER_TIMEOUT),
        });
        if (statsRes.ok) {
          const statsData = await statsRes.json() as any;
          for (const item of (statsData.items || [])) {
            const iso = item.contentDetails?.duration || '';
            statsMap[item.id] = {
              viewCount: parseInt(item.statistics?.viewCount || '0', 10),
              duration: formatISO8601Duration(iso),
              durationSeconds: parseISO8601DurationToSeconds(iso),
            };
          }
        }
      } catch {
        // Stats are optional, continue without them
      }
    }

    return items.map((item: any, idx: number) => {
      const videoId = item.id?.videoId || '';
      const stats = statsMap[videoId];
      return {
        id: `yt-${videoId}-${idx}`,
        title: decodeHtmlEntities(item.snippet?.title || 'YouTube Video'),
        url: `https://www.youtube.com/watch?v=${videoId}`,
        source: 'youtube' as const,
        description: decodeHtmlEntities(item.snippet?.description || ''),
        metadata: {
          channel: item.snippet?.channelTitle || '',
          views: stats?.viewCount,
          duration: stats?.duration,
          thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || '',
          // Store raw seconds for ranking bonus
          ...(stats?.durationSeconds ? { durationSeconds: stats.durationSeconds } : {}),
        },
        relevanceScore: 0,
      };
    });
  } catch (err) {
    console.warn('YouTube search failed:', err);
    return [];
  }
}

/** GitHub Search API — with optional language filter for programming topics */
async function searchGitHub(
  query: string,
  maxResults: number = 5,
  languageFilter?: string
): Promise<SearchedResource[]> {
  const token = process.env.GITHUB_TOKEN;

  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Build a targeted query: use language filter when available (eliminates false positives)
    // Without language filter: add "in:name,description" only (not readme — too broad)
    let ghQuery = query;
    if (languageFilter) {
      // e.g. "golang tutorial examples language:Go"
      ghQuery = `${query} language:${languageFilter}`;
    } else {
      ghQuery = `${query} in:name,description`;
    }

    const params = new URLSearchParams({
      q: ghQuery,
      sort: 'stars',
      order: 'desc',
      per_page: String(maxResults),
    });

    const res = await fetch(`https://api.github.com/search/repositories?${params}`, {
      headers,
      signal: AbortSignal.timeout(ADAPTER_TIMEOUT),
    });

    if (!res.ok) {
      console.warn(`GitHub API error (${res.status}):`, await res.text());
      return [];
    }

    const data = await res.json() as any;
    const items = data.items || [];

    return items.map((repo: any, idx: number) => ({
      id: `gh-${repo.id}-${idx}`,
      title: repo.full_name || repo.name || 'GitHub Repository',
      url: repo.html_url || '',
      source: 'github' as const,
      description: repo.description || `A ${repo.language || ''} repository with ${repo.stargazers_count} stars.`,
      metadata: {
        stars: repo.stargazers_count || 0,
        language: repo.language || '',
        tags: (repo.topics || []).slice(0, 5),
      },
      relevanceScore: 0,
    }));
  } catch (err) {
    console.warn('GitHub search failed:', err);
    return [];
  }
}

/** Google Custom Search Engine (Programmable Search) */
async function searchGoogleCSE(query: string, maxResults: number = 5): Promise<SearchedResource[]> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const engineId = process.env.GOOGLE_CSE_ENGINE_ID;

  if (!apiKey || !engineId) {
    console.log('Google CSE: No GOOGLE_CSE_API_KEY or GOOGLE_CSE_ENGINE_ID configured, checking KNOWN_DOCS_MAP fallback.');
    const key = query.toLowerCase().split(' ')[0];
    const known = KNOWN_DOCS_MAP[key] || KNOWN_DOCS_MAP[query.toLowerCase()];
    if (known) {
      return known.map((d, idx) => ({
        id: `doc-${idx}-${Date.now()}`,
        title: d.title,
        url: d.url,
        source: 'google' as const,
        description: d.description,
        metadata: {},
        relevanceScore: 0,
      }));
    }
    return [];
  }

  try {
    const params = new URLSearchParams({
      key: apiKey,
      cx: engineId,
      q: query,
      num: String(Math.min(maxResults, 10)),
    });

    const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`, {
      signal: AbortSignal.timeout(ADAPTER_TIMEOUT),
    });

    if (!res.ok) {
      console.warn(`Google CSE error (${res.status}):`, await res.text());
      return [];
    }

    const data = await res.json() as any;
    const items = data.items || [];

    return items.map((item: any, idx: number) => ({
      id: `gcs-${idx}-${Date.now()}`,
      title: item.title || 'Web Resource',
      url: item.link || '',
      source: 'google' as const,
      description: item.snippet || '',
      metadata: {
        thumbnail: item.pagemap?.cse_thumbnail?.[0]?.src || '',
      },
      relevanceScore: 0,
    }));
  } catch (err) {
    console.warn('Google CSE search failed:', err);
    return [];
  }
}

/** Stack Exchange / Stack Overflow API — with optional tag filter */
async function searchStackOverflow(
  query: string,
  maxResults: number = 5,
  tagFilter?: string
): Promise<SearchedResource[]> {
  const apiKey = process.env.STACKEXCHANGE_KEY;

  try {
    const params = new URLSearchParams({
      order: 'desc',
      sort: 'relevance',
      q: query,
      site: 'stackoverflow',
      pagesize: String(maxResults),
      filter: 'default',
    });

    // Add tag filter for much higher accuracy (e.g. tag=go eliminates non-Go questions)
    if (tagFilter) {
      params.set('tagged', tagFilter);
    }

    if (apiKey) {
      params.set('key', apiKey);
    }

    const res = await fetch(`https://api.stackexchange.com/2.3/search/advanced?${params}`, {
      signal: AbortSignal.timeout(ADAPTER_TIMEOUT),
    });

    if (!res.ok) {
      console.warn(`Stack Overflow API error (${res.status})`);
      return [];
    }

    const data = await res.json() as any;
    const items = data.items || [];

    return items
      .filter((item: any) => item.is_answered) // Only include answered questions
      .map((item: any, idx: number) => ({
        id: `so-${item.question_id}-${idx}`,
        title: decodeHtmlEntities(item.title || 'Stack Overflow Question'),
        url: item.link || `https://stackoverflow.com/questions/${item.question_id}`,
        source: 'stackoverflow' as const,
        description: `${item.answer_count} answers · ${item.view_count} views · Tags: ${(item.tags || []).join(', ')}`,
        metadata: {
          votes: item.score || 0,
          views: item.view_count || 0,
          tags: item.tags || [],
        },
        relevanceScore: 0,
      }));
  } catch (err) {
    console.warn('Stack Overflow search failed:', err);
    return [];
  }
}

/**
 * Local notes search — searches existing resources in SQLite using embeddings.
 * Threshold raised from 0.1 → 0.3 to reduce false positives.
 */
async function searchLocalNotes(query: string, maxResults: number = 5): Promise<SearchedResource[]> {
  try {
    const resources = db.prepare('SELECT * FROM resources').all() as any[];
    if (resources.length === 0) return [];

    const queryVec = await getEmbedding(query);

    const scored = await Promise.all(
      resources.map(async (r) => {
        const textToEmbed = `${r.title}\n${r.url_or_content}`;
        const resVec = await getEmbedding(textToEmbed);
        const sim = cosineSimilarity(queryVec, resVec);
        return { resource: r, score: sim };
      })
    );

    scored.sort((a, b) => b.score - a.score);
    // Tighter threshold: 0.3 (was 0.1) — prevents unrelated notes from surfacing
    const top = scored.slice(0, maxResults).filter(s => s.score > 0.3);

    return top.map((s, idx) => ({
      id: `local-${s.resource.id}-${idx}`,
      title: s.resource.title,
      url: s.resource.type === 'youtube' ? s.resource.url_or_content : '',
      source: 'local' as const,
      description: s.resource.url_or_content.substring(0, 200),
      metadata: {
        tags: (() => {
          try { return JSON.parse(s.resource.tags || '[]'); } catch { return []; }
        })(),
      },
      relevanceScore: s.score,
    }));
  } catch (err) {
    console.warn('Local notes search failed:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Layer 5: Ranking
// ---------------------------------------------------------------------------

/**
 * Rank search results by relevance.
 * Uses Ollama for intelligent re-ranking when available, falls back to heuristic scoring.
 */
async function rankResources(
  results: SearchedResource[],
  dis: DisambiguationResult,
  skillLevel?: string,
  model?: string
): Promise<SearchedResource[]> {
  if (results.length === 0) return [];

  const { available } = await isOllamaAvailable();

  if (available && results.length > 3) {
    try {
      const shortList = results.slice(0, 20).map((r, i) => (
        `${i + 1}. [${r.source.toUpperCase()}] "${r.title}" — ${r.description.substring(0, 80)}`
      )).join('\n');

      const prompt = `You are ranking learning resources for someone studying "${dis.fullName}"${skillLevel ? ` at the ${skillLevel} level` : ''}.
Context: ${dis.context}

Here are ${Math.min(results.length, 20)} resources found from various sources:
${shortList}

Rank the TOP 10 most useful resources by their index numbers, from most to least useful for learning this EXACT topic.
Only include resources that are genuinely about "${dis.fullName}" — exclude any that appear to be about unrelated topics.
Return ONLY a JSON array of index numbers (1-based), e.g. [3, 1, 7, 5, 2, 8, 4, 6, 9, 10]
No markdown, no explanation.`;

      const { text, offline } = await generateText(prompt, model);

      if (!offline) {
        const jsonMatch = text.match(/\[\s*\d[\s\S]*?\]/);
        if (jsonMatch) {
          const ranking: number[] = JSON.parse(jsonMatch[0]);
          if (Array.isArray(ranking) && ranking.length > 0) {
            const scored = results.map(r => ({ ...r }));
            ranking.forEach((oneBasedIdx, position) => {
              const idx = oneBasedIdx - 1;
              if (idx >= 0 && idx < scored.length) {
                scored[idx].relevanceScore = 100 - position * 5;
              }
            });

            scored.forEach(r => {
              if (r.relevanceScore === 0) {
                r.relevanceScore = heuristicScore(r);
              }
            });

            scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
            return scored;
          }
        }
      }
    } catch (err) {
      console.warn('LLM ranking failed, using heuristic:', err);
    }
  }

  // Heuristic fallback
  const scored = results.map(r => ({
    ...r,
    relevanceScore: heuristicScore(r),
  }));

  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return scored;
}

/** Heuristic scoring when LLM is unavailable */
function heuristicScore(r: SearchedResource): number {
  const sourceWeights: Record<string, number> = {
    youtube: 30,
    google: 25,
    github: 20,
    stackoverflow: 15,
    local: 35, // Local notes are highly relevant by definition
  };

  let score = sourceWeights[r.source] || 10;

  // Popularity bonus
  if (r.metadata.views && r.metadata.views > 10000) score += 10;
  if (r.metadata.views && r.metadata.views > 100000) score += 10;
  if (r.metadata.views && r.metadata.views > 1000000) score += 10;
  if (r.metadata.stars && r.metadata.stars > 100) score += 10;
  if (r.metadata.stars && r.metadata.stars > 1000) score += 15;
  if (r.metadata.votes && r.metadata.votes > 10) score += 10;
  if (r.metadata.votes && r.metadata.votes > 50) score += 10;

  // YouTube: boost longer educational content (full courses > 20 min)
  if (r.source === 'youtube' && (r.metadata as any).durationSeconds) {
    const secs = (r.metadata as any).durationSeconds as number;
    if (secs > 1200) score += 10;  // >20 min
    if (secs > 3600) score += 10;  // >1 hour
  }

  return score;
}

// ---------------------------------------------------------------------------
// Main Orchestrator
// ---------------------------------------------------------------------------

/**
 * Main entry point: disambiguates topic, generates per-source queries,
 * searches all sources in parallel, deduplicates, and ranks the combined results.
 */
export async function searchResources(options: SearchOptions): Promise<{
  resources: SearchedResource[];
  searchQueries: string[];
  sourceCounts: Record<string, number>;
  disambiguation: DisambiguationResult;
}> {
  const {
    topic,
    skillLevel,
    learningGoal,
    learningContext,
    maxPerSource = 5,
    sources = ['youtube', 'github', 'google', 'stackoverflow', 'local'],
    model,
  } = options;

  // ── Layer 1: Disambiguate ─────────────────────────────────────────────────
  const dis = await disambiguateTopic(topic, learningContext, model);
  console.log(`[ResourceSearch] Disambiguation: "${topic}" → canonical: "${dis.canonical}"${dis.githubLanguage ? ` | GitHub lang: ${dis.githubLanguage}` : ''}${dis.stackoverflowTag ? ` | SO tag: ${dis.stackoverflowTag}` : ''}`);

  // ── Layer 2: Per-source query generation ──────────────────────────────────
  const queries = await generateSourceQueries(dis, skillLevel, learningGoal, learningContext, model);
  console.log(`[ResourceSearch] Source queries:`, {
    youtube: queries.youtube,
    github: queries.github,
    google: queries.google,
    stackoverflow: queries.stackoverflow,
  });

  // ── Layer 3: Parallel source searches ─────────────────────────────────────
  const allResults: SearchedResource[] = [];
  const sourceCounts: Record<string, number> = {};
  const searchPromises: Promise<SearchedResource[]>[] = [];

  if (sources.includes('youtube')) {
    // Two YouTube queries for broader coverage
    searchPromises.push(
      searchYouTube(queries.youtube[0], maxPerSource)
        .then(results => { sourceCounts.youtube = results.length; return results; })
    );
    if (queries.youtube[1]) {
      searchPromises.push(searchYouTube(queries.youtube[1], Math.ceil(maxPerSource / 2)));
    }
  }

  if (sources.includes('github')) {
    // Pass language filter for programming topics — eliminates false positives
    searchPromises.push(
      searchGitHub(queries.github, maxPerSource, dis.githubLanguage)
        .then(results => { sourceCounts.github = results.length; return results; })
    );
  }

  if (sources.includes('google')) {
    searchPromises.push(
      searchGoogleCSE(queries.google, maxPerSource)
        .then(results => { sourceCounts.google = results.length; return results; })
    );
  }

  if (sources.includes('stackoverflow')) {
    // Pass SO tag filter for much more accurate results
    searchPromises.push(
      searchStackOverflow(queries.stackoverflow, maxPerSource, dis.stackoverflowTag)
        .then(results => { sourceCounts.stackoverflow = results.length; return results; })
    );
  }

  if (sources.includes('local')) {
    // Local search uses canonical term for better embedding matching
    searchPromises.push(
      searchLocalNotes(dis.canonical, maxPerSource)
        .then(results => { sourceCounts.local = results.length; return results; })
    );
  }

  const searchResults = await Promise.allSettled(searchPromises);

  for (const result of searchResults) {
    if (result.status === 'fulfilled') {
      allResults.push(...result.value);
    } else {
      console.warn('[ResourceSearch] A source adapter failed:', result.reason);
    }
  }

  console.log(`[ResourceSearch] Total raw results: ${allResults.length} from ${Object.keys(sourceCounts).length} sources`);

  // ── Layer 4: Deduplicate by URL ───────────────────────────────────────────
  const seen = new Set<string>();
  const unique = allResults.filter(r => {
    if (!r.url || seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  // ── Layer 5: Rank ─────────────────────────────────────────────────────────
  const ranked = await rankResources(unique, dis, skillLevel, model);

  return {
    resources: ranked,
    searchQueries: queries.allQueries,
    sourceCounts,
    disambiguation: dis,
  };
}

// ---------------------------------------------------------------------------
// Legacy export (backwards compatibility)
// ---------------------------------------------------------------------------
/** @deprecated Use searchResources() directly */
export async function extractSearchTopics(
  topic: string,
  skillLevel?: string,
  learningGoal?: string,
  model?: string
): Promise<string[]> {
  const dis = await disambiguateTopic(topic, undefined, model);
  const queries = await generateSourceQueries(dis, skillLevel, learningGoal, undefined, model);
  return queries.allQueries;
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Decode HTML entities in API responses */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/** Convert ISO 8601 duration (PT15M33S) to human-readable format */
function formatISO8601Duration(iso: string): string {
  if (!iso) return '';
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return iso;
  const hours = match[1] ? `${match[1]}h ` : '';
  const minutes = match[2] ? `${match[2]}m ` : '';
  const seconds = match[3] ? `${match[3]}s` : '';
  return `${hours}${minutes}${seconds}`.trim();
}

/** Convert ISO 8601 duration to total seconds (for ranking bonus) */
function parseISO8601DurationToSeconds(iso: string): number {
  if (!iso) return 0;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}
