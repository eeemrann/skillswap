const { cleanApplication, isAcademicEmail } = require('../services/teacherService');
const { applicationInput } = require('./helpers/factories');
const { canonicalSkill, normalizeSkills, unknownSkills, categoryOfSkill, skillsInCategory, ALL_SKILLS, CATEGORIES } = require('../config/catalog');

const rejects = (overrides, message) => {
  let error;
  try { cleanApplication(applicationInput(overrides)); } catch (caught) { error = caught; }
  expect(error).toMatchObject({ status: 400, message: expect.stringMatching(message) });
};

describe('tech skill catalog', () => {
  test('is a closed, de-duplicated list of tech skills grouped in categories', () => {
    expect(CATEGORIES.length).toBeGreaterThanOrEqual(10);
    expect(ALL_SKILLS.length).toBeGreaterThan(80);
    expect(new Set(ALL_SKILLS.map((skill) => skill.toLowerCase())).size).toBe(ALL_SKILLS.length);
    expect(ALL_SKILLS).not.toEqual(expect.arrayContaining(['Guitar', 'Spanish', 'Yoga', 'Cooking']));
  });

  test('canonicalises spelling and rejects anything outside the catalog', () => {
    expect(canonicalSkill('  react ')).toBe('React');
    expect(canonicalSkill('c++')).toBe('C++');
    expect(canonicalSkill('kubernetes')).toBe('Kubernetes');
    expect(canonicalSkill('Guitar')).toBeNull();
    expect(canonicalSkill('')).toBeNull();
    expect(canonicalSkill(undefined)).toBeNull();
    expect(canonicalSkill({ $ne: 'x' })).toBeNull();
    expect(normalizeSkills(['react', 'React', 'Guitar', 'rust'])).toEqual(['React', 'Rust']);
    expect(normalizeSkills('React')).toEqual([]);
    expect(unknownSkills(['React', 'Guitar', 'Yoga'])).toEqual(['Guitar', 'Yoga']);
    expect(categoryOfSkill('Kubernetes')).toBe('cloud-devops');
    expect(skillsInCategory('security')).toContain('Penetration Testing');
    expect(skillsInCategory('nope')).toEqual([]);
  });
});

describe('teacher application validation', () => {
  test('accepts a complete application and cleans it', () => {
    const cleaned = cleanApplication(applicationInput({ skills: ['go', 'GO', 'system design'], institutionalEmail: ' Jane@Example.EDU ', links: { linkedin: 'linkedin.com/in/jane' } }));
    expect(cleaned).toMatchObject({
      teacherType: 'university_lecturer', skills: ['Go', 'System Design'], institutionalEmail: 'jane@example.edu',
      links: { linkedin: 'https://linkedin.com/in/jane', github: '', website: '', institutionProfile: '' }, proposedRateCredits: 2
    });
    expect(cleaned.credentials[0]).toMatchObject({ kind: 'degree', title: 'PhD Computer Science', year: 2018, url: 'https://example.edu/phd' });
  });

  test('requires a recognised way of qualifying and a real introduction', () => {
    rejects({ teacherType: 'wizard' }, /how you qualify/);
    rejects({ headline: 'Short' }, /headline/);
    rejects({ statement: 'Too short to judge anyone by.' }, /at least 40 characters/);
    rejects({ yearsExperience: 0 }, /between 1 and 60/);
    rejects({ yearsExperience: 'many' }, /between 1 and 60/);
  });

  test('lecturers and professionals must name their institution and role', () => {
    rejects({ teacherType: 'university_lecturer', organization: '' }, /university/);
    rejects({ teacherType: 'industry_professional', jobTitle: '' }, /employer/);
    expect(() => cleanApplication(applicationInput({ teacherType: 'independent_expert', organization: '', jobTitle: '' }))).not.toThrow();
  });

  test('only catalog skills, between one and ten', () => {
    rejects({ skills: [] }, /at least one skill/);
    rejects({ skills: ['Go', 'Guitar'] }, /tech skills.*Guitar/);
    rejects({ skills: ['HTML & CSS', 'JavaScript', 'TypeScript', 'React', 'Next.js', 'Vue.js', 'Angular', 'Svelte', 'Node.js', 'Tailwind CSS', 'Python'] }, /up to 10 skills/);
  });

  test('needs proof: at least one credential and one verifiable link', () => {
    rejects({ credentials: [] }, /at least one credential/);
    rejects({ credentials: [{ kind: 'diploma', title: 'X', issuer: 'Y' }] }, /choose a type/);
    rejects({ credentials: [{ kind: 'degree', title: 'X', issuer: '' }] }, /title and who issued/);
    rejects({ credentials: [{ kind: 'degree', title: 'MSc', issuer: 'MIT', year: 1800 }] }, /year looks wrong/);
    rejects({ credentials: [{ kind: 'degree', title: 'MSc', issuer: 'MIT', url: 'javascript:alert(1)' }] }, /link/);
    rejects({ links: {} }, /at least one link/);
    rejects({ links: { linkedin: 'not a link' } }, /LinkedIn link is not a valid link/);
    rejects({ links: { website: 'ftp://files.example.com/cv' } }, /web link/);
  });

  test('hourly rate must be on the 0.25 grid and within the expert cap', () => {
    rejects({ proposedRateCredits: 0.25 }, /between 0.5 and 8/);
    rejects({ proposedRateCredits: 2.1 }, /between 0.5 and 8/);
    rejects({ proposedRateCredits: 9 }, /between 0.5 and 8/);
    expect(cleanApplication(applicationInput({ proposedRateCredits: 7.75 })).proposedRateCredits).toBe(7.75);
  });

  test('a malformed email is refused, an empty one is allowed', () => {
    rejects({ institutionalEmail: 'jane@' }, /email is not valid/);
    expect(cleanApplication(applicationInput({ institutionalEmail: '' })).institutionalEmail).toBe('');
  });

  test('recognises university and research domains as a hint for reviewers', () => {
    ['jane@mit.edu', 'a@cs.ox.ac.uk', 'x@du.edu.bd', 'y@iitb.ac.in', 'z@uni.edu.au'].forEach((email) => expect(isAcademicEmail(email)).toBe(true));
    ['jane@gmail.com', 'a@education.com', 'b@academy.io', 'c@school.edu.example.com', ''].forEach((email) => expect(isAcademicEmail(email)).toBe(false));
  });
});
