import { NodePrototype, TemplateRegistry } from './prototype.js';

// Вбудовані шаблони. Корінь карти бере назву від користувача, тому зразок це діти кореня:
// кожен шаблон описано як вкладений список, а корінь-обгортка лише тримає дітей.
const t = (text, extra = {}, children = []) => ({ text, ...extra, children });

const SAMPLES = {
  project: {
    title: 'Проєкт',
    description: 'Мета, задачі, ресурси, ризики й терміни',
    children: [
      t('Мета', { category: 'decision' }),
      t('Задачі', { category: 'task' }, [t('Планування'), t('Розробка'), t('Тестування')]),
      t('Ресурси', {}, [t('Люди'), t('Бюджет'), t('Інструменти')]),
      t('Ризики', { category: 'risk', priority: 'high' }),
      t('Терміни', { priority: 'urgent' }),
    ],
  },
  swot: {
    title: 'SWOT-аналіз',
    description: 'Сильні й слабкі сторони, можливості та загрози',
    children: [
      t('Сильні сторони', {}, [t('Додай ідею')]),
      t('Слабкі сторони', {}, [t('Додай ідею')]),
      t('Можливості', { category: 'idea' }, [t('Додай ідею')]),
      t('Загрози', { category: 'risk' }, [t('Додай ідею')]),
    ],
  },
  brainstorm: {
    title: 'Мозковий штурм',
    description: 'Проблема, ідеї, обмеження й наступні кроки',
    children: [
      t('Проблема', { category: 'question' }),
      t('Ідеї', { category: 'idea' }, [t('Ідея 1'), t('Ідея 2'), t('Ідея 3')]),
      t('Обмеження', { category: 'risk' }),
      t('Наступні кроки', { category: 'task', priority: 'high' }),
    ],
  },
  week: {
    title: 'План тижня',
    description: 'Сім днів тижня',
    children: ['Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота', 'Неділя'].map((d) => t(d)),
  },
  coursework: {
    title: 'Курсова робота',
    description: 'Типові розділи курсової від вступу до оформлення',
    children: [
      t('Вступ', {}, [t('Актуальність'), t('Мета і завдання')]),
      t('Аналіз', {}, [t('Аналоги'), t('Вимоги')]),
      t('Проєктування', {}),
      t('Реалізація', { category: 'task' }),
      t('Тестування'),
      t('Висновки'),
      t('Оформлення', { priority: 'high' }),
    ],
  },
};

export function buildTemplateRegistry() {
  const registry = new TemplateRegistry();
  for (const [key, { title, description, children }] of Object.entries(SAMPLES)) {
    registry.register(key, { title, description, prototype: NodePrototype.fromSnapshot({ text: title, children }) });
  }
  return registry;
}
