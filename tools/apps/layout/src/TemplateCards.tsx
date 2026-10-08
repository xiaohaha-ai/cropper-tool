import { memo } from 'react';
import { Plus } from '@phosphor-icons/react';
import type { Template } from './model';

// The library does not change when the article's text changes.
export const TemplateCards = memo(function TemplateCards({ items, onInsert, onDrag }: {
  items: Template[];
  onInsert: (template: Template) => void;
  onDrag: (id: string) => void;
}) {
  return items.map(template => <button className="template-card" data-template-id={template.id}
    key={template.id} title={`插入：${template.name}`} onClick={() => onInsert(template)} draggable
    onDragStart={event => { event.dataTransfer.setData('text/x-template', template.id); onDrag('template:' + template.id); }}
    onDragEnd={() => onDrag('')}>
    <div className="template-render" dangerouslySetInnerHTML={{ __html: template.html }} />
    <span className="template-hover"><Plus size={13} />点击插入 · {template.name}</span>
  </button>);
});
