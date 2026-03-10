/**
 * Curated content for SEO pages. Use {jobTitle} for interpolation.
 */

export type FAQItem = { question: string; answer: string };

const DEFAULT_QUESTIONS: FAQItem[] = [
  { question: "What are the most common interview questions for this role?", answer: "Common questions include experience with key technologies, past project examples, how you handle deadlines, and your approach to teamwork and problem-solving." },
  { question: "How should I prepare for a technical interview?", answer: "Review the job description, practice coding or domain-specific tasks, and prepare examples from your experience that demonstrate your skills." },
  { question: "What behavioral questions might I be asked?", answer: "You may be asked about conflict resolution, leadership, failure and learning, and how you prioritize under pressure." },
  { question: "How long should my answers be?", answer: "Keep answers concise: 1–2 minutes for behavioral questions, and for technical questions provide clear structure (situation, approach, result) where relevant." },
  { question: "Should I ask questions at the end?", answer: "Yes. Prepare 2–3 questions about the role, team, or company to show interest and clarify expectations." },
];

const DEFAULT_BEHAVIORAL = [
  "Tell me about a time you had to meet a tight deadline.",
  "Describe a situation where you had to work with a difficult stakeholder.",
  "Give an example of when you failed and what you learned.",
  "How do you prioritize when you have multiple urgent tasks?",
];

const DEFAULT_TECHNICAL: Record<string, string[]> = {
  "Frontend Developer": ["Explain the difference between React state and props.", "How do you optimize frontend performance?", "Describe your experience with responsive design."],
  "Backend Developer": ["How do you design scalable APIs?", "Explain database indexing and when to use it.", "Describe your approach to error handling and logging."],
  "Full Stack Developer": ["How do you split responsibilities between frontend and backend?", "Describe your deployment and CI/CD experience.", "How do you ensure security across the stack?"],
  "Data Scientist": ["How do you validate a model?", "Explain the bias-variance tradeoff.", "Describe a project where you used data to drive decisions."],
  "Product Manager": ["How do you prioritize a backlog?", "Describe how you gather and use user feedback.", "How do you work with engineering and design?"],
  "DevOps Engineer": ["Explain your approach to infrastructure as code.", "How do you handle zero-downtime deployments?", "Describe your monitoring and alerting strategy."],
};

function getTechnicalQuestions(jobTitle: string): string[] {
  return DEFAULT_TECHNICAL[jobTitle] ?? [
    "What are the key technologies you use in this role?",
    "Describe a challenging technical problem you solved.",
    "How do you stay updated with industry changes?",
  ];
}

export function getInterviewQuestionsContent(jobTitle: string) {
  return {
    faqItems: DEFAULT_QUESTIONS.map((item) => ({
      question: item.question.replace("this role", jobTitle.toLowerCase()),
      answer: item.answer,
    })),
    behavioralQuestions: DEFAULT_BEHAVIORAL,
    technicalQuestions: getTechnicalQuestions(jobTitle),
    intro: `Preparing for a ${jobTitle} interview? This page lists common questions and tips so you can practice and build confidence.`,
    tips: [
      "Research the company and role before the interview.",
      "Prepare 2–3 concrete examples from your experience.",
      "Practice out loud or with a friend to improve clarity.",
      "Use the STAR method (Situation, Task, Action, Result) for behavioral questions.",
    ],
  };
}

export function getInterviewGuideContent(jobTitle: string) {
  return {
    intro: `A practical guide to preparing for your ${jobTitle} interview, from research to follow-up.`,
    sections: [
      { heading: "Before the interview", body: "Review the job description, company values, and recent news. Align your examples with the role requirements." },
      { heading: "During the interview", body: "Listen carefully, answer concisely, and ask clarifying questions. Use specific examples from your experience." },
      { heading: "After the interview", body: "Send a brief thank-you note and recap key points you discussed. Follow up if you don't hear back within the stated timeframe." },
    ],
  };
}

export function getResumeExamplesContent(jobTitle: string) {
  return {
    intro: `See what strong resume content looks like for ${jobTitle} roles: structure, keywords, and how to highlight relevant experience.`,
    sections: [
      { heading: "Summary", body: "Write a short summary that matches the role. Include years of experience and key skills mentioned in the job description." },
      { heading: "Experience", body: "Use bullet points with metrics and outcomes. Start with action verbs and align with the role's requirements." },
      { heading: "Skills", body: "List technical and soft skills relevant to the position. Group by category if helpful." },
    ],
  };
}

export function getSkillsContent(jobTitle: string) {
  return {
    intro: `Key skills that matter for ${jobTitle} positions and how to present them on your resume and in interviews.`,
    sections: [
      { heading: "Technical skills", body: "Identify the tools and technologies commonly required. Highlight your proficiency and recent projects." },
      { heading: "Soft skills", body: "Communication, teamwork, and problem-solving are valued across roles. Prepare examples." },
      { heading: "How to demonstrate", body: "Use your CV and interview answers to show how you've applied these skills in real situations." },
    ],
  };
}

export function getSalaryContent(jobTitle: string) {
  return {
    intro: `What to expect for ${jobTitle} compensation: factors that influence pay and how to research and negotiate.`,
    sections: [
      { heading: "Factors that affect pay", body: "Experience, location, company size, and industry all influence salary. Research ranges for your level and region." },
      { heading: "Researching salary", body: "Use job boards, salary surveys, and your network to understand typical ranges before negotiating." },
      { heading: "Negotiation tips", body: "Know your range, anchor with data, and consider total compensation (benefits, equity) not just base salary." },
    ],
  };
}
