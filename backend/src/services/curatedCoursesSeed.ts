import { getDbInstance } from '../db.js';

export interface CourseResource {
  id: string;
  type: 'youtube' | 'pdf' | 'link' | 'note';
  title: string;
  url_or_content: string;
  tags: string[];
  summary?: string;
}

export const CURATED_COURSES: CourseResource[] = [
  // --- Artificial Intelligence & Machine Learning ---
  {
    id: 'course-ai-1',
    type: 'youtube',
    title: 'Machine Learning Specialization by Andrew Ng',
    url_or_content: 'https://www.youtube.com/playlist?list=PLoROMvodv4rMiGQp3WXShtMGgzqpfVfbU',
    tags: ['machine-learning', 'ai', 'andrew-ng', 'python', 'deep-learning'],
    summary: 'Comprehensive introduction to Machine Learning covering Supervised Learning, Logistic Regression, Neural Networks, and Advice for Applying ML.'
  },
  {
    id: 'course-ai-2',
    type: 'youtube',
    title: 'Deep Learning Specialization (Andrew Ng / DeepLearning.AI)',
    url_or_content: 'https://www.youtube.com/playlist?list=PLoROMvodv4rOABXSygHTsbvUz4G_YQhMg',
    tags: ['deep-learning', 'neural-networks', 'cnn', 'rnn', 'ai'],
    summary: 'Master Deep Learning, Convolutional Networks (CNNs), Sequence Models (RNNs/LSTMs), and Hyperparameter Tuning.'
  },
  {
    id: 'course-ai-3',
    type: 'youtube',
    title: 'Fast.ai: Practical Deep Learning for Coders',
    url_or_content: 'https://course.fast.ai/',
    tags: ['fastai', 'deep-learning', 'pytorch', 'python', 'computer-vision'],
    summary: 'Top-down practical approach to training state-of-the-art computer vision, NLP, and tabular data models using PyTorch & Fastai.'
  },
  {
    id: 'course-ai-4',
    type: 'youtube',
    title: 'Karpathy: Neural Networks Zero to Hero',
    url_or_content: 'https://www.youtube.com/playlist?list=SLaFCTi-n778',
    tags: ['andrej-karpathy', 'gpt', 'transformers', 'pytorch', 'backpropagation'],
    summary: 'Build micrograd, makemore, and a GPT transformer model from scratch in Python and PyTorch by Andrej Karpathy.'
  },
  {
    id: 'course-ai-5',
    type: 'youtube',
    title: 'LangChain & LLM Application Development',
    url_or_content: 'https://www.youtube.com/playlist?list=PL8motc6AQftw1u92K7O68e_e4bLqR59X-',
    tags: ['langchain', 'llm', 'rag', 'openai', 'vector-database'],
    summary: 'Build RAG pipelines, agents, memory, and custom chains with LangChain and vector databases.'
  },

  // --- Web Development & JavaScript ---
  {
    id: 'course-web-1',
    type: 'youtube',
    title: 'Full Stack Web Development - FreeCodeCamp',
    url_or_content: 'https://www.youtube.com/watch?v=nu_pCVPKzTk',
    tags: ['fullstack', 'web-dev', 'react', 'nodejs', 'javascript'],
    summary: 'Complete full stack web developer bootcamp covering HTML, CSS, JavaScript, React, Node.js, and Express.'
  },
  {
    id: 'course-web-2',
    type: 'youtube',
    title: 'React.js Complete Course 2026',
    url_or_content: 'https://www.youtube.com/watch?v=bMknFK5e2k8',
    tags: ['react', 'frontend', 'javascript', 'hooks', 'state-management'],
    summary: 'Modern React from scratch covering Functional Components, Custom Hooks, Context API, Redux Toolkit, and Tailwind CSS.'
  },
  {
    id: 'course-web-3',
    type: 'youtube',
    title: 'Next.js 14/15 Full Course - App Router & Server Actions',
    url_or_content: 'https://www.youtube.com/watch?v=wm5gMKCOBgs',
    tags: ['nextjs', 'react', 'typescript', 'server-actions', 'ssr'],
    summary: 'Production Next.js application setup with Server Components, App Router, authentication, Prisma ORM, and deployment.'
  },
  {
    id: 'course-web-4',
    type: 'youtube',
    title: 'TypeScript for Beginners to Advanced',
    url_or_content: 'https://www.youtube.com/watch?v=d56mG7DezGs',
    tags: ['typescript', 'javascript', 'frontend', 'backend', 'type-safety'],
    summary: 'Master TypeScript interfaces, generics, utility types, type guards, and integration with React/Node.'
  },

  // --- Python & Data Science ---
  {
    id: 'course-py-1',
    type: 'youtube',
    title: '100 Days of Code: Complete Python Developer Bootcamp',
    url_or_content: 'https://www.youtube.com/playlist?list=PLsyeobzWj7zr07D67y0VpWp5YpC1U7d9a',
    tags: ['python', 'programming', 'basics', 'oop', 'projects'],
    summary: 'Learn Python programming from scratch through hands-on projects, object-oriented programming, and real-world tools.'
  },
  {
    id: 'course-py-2',
    type: 'youtube',
    title: 'Data Science & Data Analysis Bootcamp (Pandas & NumPy)',
    url_or_content: 'https://www.youtube.com/watch?v=r-uOLxNrNk8',
    tags: ['data-science', 'pandas', 'numpy', 'matplotlib', 'python'],
    summary: 'Comprehensive data analysis masterclass using Python, Pandas, NumPy, Seaborn, and Matplotlib.'
  },

  // --- Computer Science & Data Structures (DSA) ---
  {
    id: 'course-dsa-1',
    type: 'youtube',
    title: 'Data Structures and Algorithms in Python / C++',
    url_or_content: 'https://www.youtube.com/playlist?list=PLgUwDviBIf0oF6QL8m22w1hIDC1vJ_BHz',
    tags: ['dsa', 'algorithms', 'leetcode', 'data-structures', 'interview-prep'],
    summary: 'Complete DSA roadmap: Dynamic Programming, Graph Theory, Trees, Recursion, Binary Search, and LeetCode patterns.'
  },
  {
    id: 'course-dsa-2',
    type: 'youtube',
    title: 'System Design Interview & Microservices Architecture',
    url_or_content: 'https://www.youtube.com/playlist?list=PLMCXHnjXnTnvo6alSjVkgxV-VH6EPyvoX',
    tags: ['system-design', 'backend', 'scalability', 'microservices', 'caching'],
    summary: 'Learn system design fundamentals: load balancers, database sharding, caching, message queues, and rate limiters.'
  },

  // --- DevOps & Cloud Computing ---
  {
    id: 'course-devops-1',
    type: 'youtube',
    title: 'Docker & Kubernetes Full Course',
    url_or_content: 'https://www.youtube.com/watch?v=3c-iBn73dDE',
    tags: ['docker', 'kubernetes', 'devops', 'containers', 'cloud'],
    summary: 'Master containerization with Docker, multi-container Compose, and container orchestration using Kubernetes clusters.'
  }
];

/**
 * Seed curated course resources into the SQLite database.
 */
export function seedCuratedCourses(): { addedCount: number; totalCount: number } {
  const db = getDbInstance();

  const checkStmt = db.prepare('SELECT COUNT(*) as count FROM resources WHERE id = ?');
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO resources (id, type, title, url_or_content, tags, summary)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let addedCount = 0;

  const insertTransaction = db.transaction((courses: CourseResource[]) => {
    for (const course of courses) {
      const existing = checkStmt.get(course.id) as { count: number };
      if (!existing || existing.count === 0) {
        insertStmt.run(
          course.id,
          course.type,
          course.title,
          course.url_or_content,
          JSON.stringify(course.tags),
          course.summary || ''
        );
        addedCount++;
      }
    }
  });

  insertTransaction(CURATED_COURSES);

  const total = db.prepare('SELECT COUNT(*) as count FROM resources').get() as { count: number };
  console.log(`[Seed] Curated course dataset check complete. Added: ${addedCount}, Total Internal Resources: ${total.count}`);

  return { addedCount, totalCount: total.count };
}
