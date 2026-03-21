/**
 * Single source of truth for job titles used across the app and SEO pages.
 * Slug utilities for URL-safe segments.
 *
 * "Frontend Developer" stays first so default dropdowns and legacy fallbacks match prior behavior.
 */

export const JOB_TITLES = [
  "Frontend Developer",
  ".NET Developer",
  "Account Executive",
  "Accountant",
  "Agile Coach",
  "AI Engineer",
  "Android Developer",
  "AR/VR Developer",
  "Associate Product Manager",
  "Backend Developer",
  "BI Analyst",
  "Blockchain Developer",
  "Brand Manager",
  "Business Analyst",
  "Business Development Representative",
  "Business Intern",
  "C++ Developer",
  "Chief of Staff",
  "Cloud Engineer",
  "Computer Programmer",
  "Computer Vision Engineer",
  "Content Designer",
  "Content Marketing Manager",
  "Copywriter",
  "Customer Success Manager",
  "Customer Support Specialist",
  "Cybersecurity Specialist",
  "Data Analyst",
  "Data Analytics Engineer",
  "Data Architect",
  "Data Engineer",
  "Data Science Intern",
  "Data Scientist",
  "Database Administrator",
  "DevOps Engineer",
  "Digital Marketing Specialist",
  "Embedded Systems Engineer",
  "Engineering Intern",
  "Engineering Manager",
  "Executive Assistant",
  "Finance",
  "Finance Analyst",
  "Flutter Developer",
  "Full Stack Developer",
  "Game Developer",
  "Go Developer",
  "Growth Marketer",
  "HR Business Partner",
  "Human Resources",
  "Inside Sales Representative",
  "iOS Developer",
  "IT Support Specialist",
  "Java Developer",
  "Junior Backend Developer",
  "Junior Frontend Developer",
  "Junior Full Stack Developer",
  "Junior Software Engineer",
  "Kotlin Developer",
  "Legal Counsel",
  "Machine Learning Engineer",
  "Marketing",
  "Marketing Intern",
  "Marketing Specialist",
  "MLOps Engineer",
  "Mobile Developer",
  "Network Engineer",
  "NLP Engineer",
  "Node.js Developer",
  "Office Manager",
  "Operations Manager",
  "Other",
  "Payroll Specialist",
  "People Operations Manager",
  "PHP Developer",
  "Platform Engineer",
  "Procurement Manager",
  "Product Designer",
  "Product Manager",
  "Product Marketing Manager",
  "Product Owner",
  "Program Manager",
  "Project Manager",
  "Python Developer",
  "QA Engineer",
  "React Developer",
  "Recruiter",
  "Release Manager",
  "Ruby Developer",
  "Ruby on Rails Developer",
  "Rust Developer",
  "Sales Manager",
  "Salesforce Developer",
  "Scala Developer",
  "Scrum Master",
  "Security Engineer",
  "SEO Specialist",
  "Site Reliability Engineer",
  "Social Media Manager",
  "Software Engineer",
  "Software Engineering Intern",
  "Solutions Architect",
  "Swift Developer",
  "Systems Administrator",
  "Technical Product Manager",
  "Technical Writer",
  "Test Automation Engineer",
  "UI Designer",
  "UX Designer",
  "UX Researcher",
  "Video Game Designer",
  "Web Developer",
  "WordPress Developer",
] as const;

export type JobTitle = (typeof JOB_TITLES)[number];

/** Normalize and slugify a job title for URL segments (lowercase, spaces to hyphens, strip non-alphanumeric except hyphen). */
export function slugifyJobTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Resolve URL slug back to canonical job title from JOB_TITLES, or null if unknown. */
export function getJobTitleBySlug(slug: string): string | null {
  const normalized = slug.trim().toLowerCase();
  for (const title of JOB_TITLES) {
    if (slugifyJobTitle(title) === normalized) return title;
  }
  return null;
}

/** All slugs for generateStaticParams and sitemap. */
export function getAllJobSlugs(): string[] {
  return JOB_TITLES.map((t) => slugifyJobTitle(t));
}
