import { useId, useState } from 'react';
import Icon from './Icon';

/**
 * Chip-based list editor. Enter or comma adds a tag; Backspace on an empty field removes the last.
 * `suggestions` are offered as one-click chips, hiding those already added.
 */
export default function TagInput({ label, hint, value, onChange, placeholder, suggestions = [], max = 25, maxLength = 80 }) {
  const id = useId();
  const [draft, setDraft] = useState('');

  const add = (raw) => {
    const tag = raw.trim().slice(0, maxLength);
    if (!tag || value.length >= max || value.some((item) => item.toLowerCase() === tag.toLowerCase())) { setDraft(''); return; }
    onChange([...value, tag]);
    setDraft('');
  };
  const remove = (tag) => onChange(value.filter((item) => item !== tag));
  const onKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); add(draft); }
    else if (event.key === 'Backspace' && !draft && value.length) remove(value[value.length - 1]);
  };
  const offered = suggestions.filter((item) => !value.some((tag) => tag.toLowerCase() === item.toLowerCase())).slice(0, 8);

  return (
    <div className="field">
      {label && <label htmlFor={id}>{label}</label>}
      <div className="tag-input">
        {value.map((tag) => (
          <span className="tag brand" key={tag}>{tag}<button type="button" onClick={() => remove(tag)} aria-label={`Remove ${tag}`}><Icon name="close" size={12} /></button></span>
        ))}
        <input id={id} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} onBlur={() => add(draft)}
          placeholder={value.length ? 'Add another…' : placeholder} maxLength={maxLength} disabled={value.length >= max} autoComplete="off" />
      </div>
      {hint && <span className="hint">{hint}</span>}
      {offered.length > 0 && (
        <div className="tags" aria-label="Suggestions">
          {offered.map((item) => <button type="button" className="tag suggestion" key={item} onClick={() => add(item)}><Icon name="plus" size={12} />{item}</button>)}
        </div>
      )}
    </div>
  );
}
