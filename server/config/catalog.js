/**
 * The skills SkillSwap trades. The platform is deliberately focused on technology,
 * so every skill a member can learn or teach comes from this closed list.
 * Names are the canonical spelling stored on profiles and bookings.
 */
const CATEGORIES = [
  { id: 'web', name: 'Web Development', skills: ['HTML & CSS', 'JavaScript', 'TypeScript', 'React', 'Next.js', 'Vue.js', 'Angular', 'Svelte', 'Node.js', 'Tailwind CSS', 'Web Accessibility', 'Web Performance'] },
  { id: 'backend', name: 'Backend & APIs', skills: ['Python', 'Java', 'Go', 'Rust', 'C#', '.NET', 'PHP', 'Laravel', 'Ruby on Rails', 'Django', 'FastAPI', 'Spring Boot', 'Express.js', 'GraphQL', 'REST API Design', 'Microservices'] },
  { id: 'mobile', name: 'Mobile Development', skills: ['Swift', 'iOS Development', 'Kotlin', 'Android Development', 'Flutter', 'React Native'] },
  { id: 'data-ai', name: 'Data & AI', skills: ['Data Analysis', 'Machine Learning', 'Deep Learning', 'Natural Language Processing', 'Computer Vision', 'LLM Engineering', 'Prompt Engineering', 'Data Engineering', 'Apache Spark', 'Statistics for Data Science', 'Power BI', 'Tableau'] },
  { id: 'cloud-devops', name: 'Cloud & DevOps', skills: ['AWS', 'Microsoft Azure', 'Google Cloud', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD', 'Linux', 'Site Reliability Engineering', 'Git & GitHub', 'Observability & Monitoring'] },
  { id: 'security', name: 'Cybersecurity', skills: ['Ethical Hacking', 'Penetration Testing', 'Application Security', 'Network Security', 'Cloud Security', 'Cryptography', 'Security Operations', 'Malware Analysis'] },
  { id: 'databases', name: 'Databases', skills: ['SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Database Design'] },
  { id: 'cs-fundamentals', name: 'Computer Science', skills: ['Data Structures & Algorithms', 'Competitive Programming', 'Technical Interview Prep', 'Computer Networks', 'Operating Systems', 'Discrete Mathematics', 'Compilers', 'Computer Architecture'] },
  { id: 'engineering', name: 'Software Engineering', skills: ['Software Architecture', 'System Design', 'Design Patterns', 'Clean Code', 'Test-Driven Development', 'QA & Test Automation', 'Agile & Scrum', 'Code Review', 'Technical Leadership', 'Open Source Contribution'] },
  { id: 'systems', name: 'Systems & Embedded', skills: ['C', 'C++', 'Embedded Systems', 'Arduino', 'Raspberry Pi', 'Internet of Things', 'Robotics'] },
  { id: 'games', name: 'Games & Graphics', skills: ['Unity', 'Unreal Engine', 'Godot', 'Game Design', 'Computer Graphics', 'Three.js & WebGL'] },
  { id: 'web3', name: 'Blockchain', skills: ['Blockchain Fundamentals', 'Solidity', 'Smart Contracts', 'Web3 Development'] },
  { id: 'product', name: 'Product & Design', skills: ['UI/UX Design', 'Figma', 'Product Management', 'Technical Writing'] }
];

const SKILL_INDEX = new Map();
CATEGORIES.forEach((category) => category.skills.forEach((skill) => SKILL_INDEX.set(skill.toLowerCase(), { skill, category: category.id })));

/** Canonical spelling of a catalog skill, or null when it is not a tech skill we trade. */
const canonicalSkill = (name) => SKILL_INDEX.get(String(name || '').trim().toLowerCase())?.skill || null;

const categoryOfSkill = (name) => SKILL_INDEX.get(String(name || '').trim().toLowerCase())?.category || null;

const skillsInCategory = (categoryId) => CATEGORIES.find((category) => category.id === categoryId)?.skills || [];

/** Keeps catalog skills only, in canonical spelling, without duplicates. */
const normalizeSkills = (list, max = 25) => {
  if (!Array.isArray(list)) return [];
  const unique = new Set();
  list.forEach((item) => {
    const skill = canonicalSkill(item);
    if (skill) unique.add(skill);
  });
  return [...unique].slice(0, max);
};

/** Names in `list` that are not in the catalog; used to explain a rejection. */
const unknownSkills = (list) => (Array.isArray(list) ? list : []).filter((item) => !canonicalSkill(item)).map(String);

const ALL_SKILLS = CATEGORIES.flatMap((category) => category.skills);

module.exports = { CATEGORIES, ALL_SKILLS, canonicalSkill, categoryOfSkill, skillsInCategory, normalizeSkills, unknownSkills };
