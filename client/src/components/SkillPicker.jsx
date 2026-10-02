import { useId, useMemo, useState } from 'react';
import { flattenSkills, useSkillCatalog } from '../lib/skills';
import Icon from './Icon';

/**
 * Picks skills from the tech catalog only: type to search, or browse by category.
 * Values are canonical catalog names, the same ones the server accepts.
 */
export default function SkillPicker({ label, hint, value, onChange, max = 25, placeholder = 'Search tech skills: React, Kubernetes, SQL…', allowed }) {
  const id = useId();
  const { categories, loading, error } = useSkillCatalog();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('');

  const everything = useMemo(() => flattenSkills(categories).filter((item) => !allowed || allowed.includes(item.skill)), [categories, allowed]);
  const chosen = useMemo(() => new Set(value.map((item) => item.toLowerCase())), [value]);
  const available = (item) => !chosen.has(item.skill.toLowerCase());
  const text = query.trim().toLowerCase();
  const matches = text ? everything.filter((item) => available(item) && item.skill.toLowerCase().includes(text)).slice(0, 8) : [];
  const browsing = category ? everything.filter((item) => item.categoryId === category && available(item)) : [];
  const full = value.length >= max;

  const add = (skill) => {
    if (full || chosen.has(skill.toLowerCase())) return;
    onChange([...value, skill]);
    setQuery('');
  };
  const remove = (skill) => onChange(value.filter((item) => item !== skill));
  const onKeyDown = (event) => {
    if (event.key === 'Enter') { event.preventDefault(); if (matches[0]) add(matches[0].skill); }
    else if (event.key === 'Escape') setOpen(false);
    else if (event.key === 'Backspace' && !query && value.length) remove(value[value.length - 1]);
  };
  const categoryList = categories.filter((item) => everything.some((skill) => skill.categoryId === item.id));

  return (
    <div className="field skill-picker">
      {label && <label htmlFor={id}>{label}</label>}
      <div className="tag-input">
        {value.map((skill) => (
          <span className="tag brand" key={skill}>{skill}<button type="button" onClick={() => remove(skill)} aria-label={`Remove ${skill}`}><Icon name="close" size={12} /></button></span>
        ))}
        <input id={id} value={query} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown} placeholder={full ? `Up to ${max} skills` : value.length ? 'Add another…' : placeholder} disabled={full || Boolean(error)} autoComplete="off"
          role="combobox" aria-expanded={open && matches.length > 0} aria-controls={`${id}-list`} />
      </div>

      {open && text && (
        <ul className="skill-menu" id={`${id}-list`} role="listbox">
          {matches.length === 0
            ? <li className="skill-menu-empty small muted">{loading ? 'Loading skills…' : `“${query.trim()}” is not in our tech catalog. SkillSwap focuses on technology skills.`}</li>
            : matches.map((item) => (
              <li key={item.skill} role="option" aria-selected="false">
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => add(item.skill)}><span>{item.skill}</span><span className="tiny faint">{item.category}</span></button>
              </li>
            ))}
        </ul>
      )}

      {hint && <span className="hint">{hint}</span>}
      {error && <span className="hint warn">The skill list could not be loaded. Refresh the page and try again.</span>}

      {!full && categoryList.length > 0 && (
        <div className="stack" style={{ '--gap': '8px' }}>
          <div className="tags" role="group" aria-label="Browse categories">
            {categoryList.map((item) => (
              <button type="button" key={item.id} className={`tag chip-button ${category === item.id ? 'brand' : ''}`} aria-pressed={category === item.id} onClick={() => setCategory(category === item.id ? '' : item.id)}>{item.name}</button>
            ))}
          </div>
          {category && (
            <div className="tags" aria-label="Skills in this category">
              {browsing.length ? browsing.map((item) => <button type="button" className="tag suggestion" key={item.skill} onClick={() => add(item.skill)}><Icon name="plus" size={12} />{item.skill}</button>)
                : <span className="small muted">You have added every skill in this category.</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
