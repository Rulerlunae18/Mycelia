// Патерн Command: історія команд для скасування і повтору (undo/redo).
//
// Команда це об'єкт { label, do(), undo(), redo()?, focusId? }. Вона знає, як виконати дію
// і як її скасувати (вона зберігає все потрібне для цього, наприклад старий текст або
// знімок видаленої гілки). History це «інвокер»: виконує команди й веде два стеки,
// нічого не знаючи про карти, вузли чи сервер. Одержувач (receiver) тут стор редактора.
//
// Дії виконуються по черзі, одна за одною, бо кожна ходить на сервер: так швидкі натискання
// Ctrl+Z не перемішають порядок. Якщо дія впала, стеки лишаються як були.

export class History {
  #undo = [];
  #redo = [];
  #queue = Promise.resolve();

  constructor({ limit = 100, onChange = () => {} } = {}) {
    this.limit = limit;
    this.onChange = onChange;
  }

  get top() { return this.#undo.at(-1) ?? null; }
  get canUndo() { return this.#undo.length > 0; }
  get canRedo() { return this.#redo.length > 0; }
  get undoLabel() { return this.#undo.at(-1)?.label ?? ''; }
  get redoLabel() { return this.#redo.at(-1)?.label ?? ''; }

  #run(task) {
    const result = this.#queue.then(task);
    this.#queue = result.catch(() => {}); // помилка однієї дії не блокує наступні
    return result;
  }

  // Виконує нову команду; нова дія робить «повтор» неможливим
  execute(cmd) {
    return this.#run(async () => {
      await cmd.do();
      // Команда може влитися в попередню (наприклад, ім'я щойно доданого вузла
      // це частина додавання): тоді в стек вона не потрапляє, а одне скасування відкочує обидві дії
      if (cmd.mergeInto?.(this.#undo.at(-1))) {
        this.#redo = [];
        this.onChange();
        return this.#undo.at(-1);
      }
      this.#undo.push(cmd);
      if (this.#undo.length > this.limit) this.#undo.shift();
      this.#redo = [];
      this.onChange();
      return cmd;
    });
  }

  // Повертає скасовану команду (або null, якщо скасовувати нічого)
  undo() {
    return this.#run(async () => {
      const cmd = this.#undo.at(-1);
      if (!cmd) return null;
      await cmd.undo();
      this.#undo.pop();
      this.#redo.push(cmd);
      this.onChange();
      return cmd;
    });
  }

  redo() {
    return this.#run(async () => {
      const cmd = this.#redo.at(-1);
      if (!cmd) return null;
      await (cmd.redo ?? cmd.do).call(cmd);
      this.#redo.pop();
      this.#undo.push(cmd);
      this.onChange();
      return cmd;
    });
  }

  // Нова карта або вкладка: стара історія не має сенсу
  clear() {
    this.#undo = [];
    this.#redo = [];
    this.onChange();
  }
}
