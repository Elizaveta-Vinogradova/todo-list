const STORAGE_KEY = "todo-list-state";

function appendChild(node, child) {
  if (child === null || child === undefined) {
    return;
  }

  if (Array.isArray(child)) {
    child.forEach((nestedChild) => appendChild(node, nestedChild));
    return;
  }

  if (child instanceof Node) {
    node.appendChild(child);
    return;
  }

  node.appendChild(document.createTextNode(String(child)));
}

function createElement(tag, attributes = {}, children = [], callbacks = []) {
  const element = document.createElement(tag);

  Object.keys(attributes).forEach((key) => {
    if (key === "checked" || key === "value") {
      element[key] = attributes[key];
    }
    else {
      element.setAttribute(key, attributes[key]);
    }
  });

  appendChild(element, children);

  if (Array.isArray(callbacks)) {
    callbacks.forEach((listener) => {
      const { event, handler } = listener;
      if (typeof event === "string" && typeof handler === "function") {
        element.addEventListener(event, handler);
      }
    });
  }

  return element;
}

class Component {
  constructor(props = {}) {
    this.props = props;
    this.state = {};
    this._children = new Map();
    this._renderedChildKeys = new Set();
  }

  getDomNode() {
    this._domNode = this.render();
    return this._domNode;
  }

  update(nextProps) {
    if (nextProps) {
      this.props = nextProps;
    }

    const nextDomNode = this.render();
    this._domNode.parentNode.replaceChild(nextDomNode, this._domNode);
    this._domNode = nextDomNode;
    return this._domNode;
  }

  beginChildrenRender() {
    this._renderedChildKeys = new Set();
  }

  renderChild(ComponentClass, key, props = {}) {
    const childKey = `${ComponentClass.name}:${String(key)}`;
    this._renderedChildKeys.add(childKey);

    let child = this._children.get(childKey);
    if (!child) {
      child = new ComponentClass(props);
      this._children.set(childKey, child);
      return child.getDomNode();
    }

    child.update(props);
    return child.getDomNode();
  }

  finishChildrenRender() {
    for (const key of this._children.keys()) {
      if (!this._renderedChildKeys.has(key)) {
        this._children.delete(key);
      }
    }
  }
}

class AddTask extends Component {
  render() {
    return createElement("div", { class: "add-todo" }, [
      createElement(
        "input",
        {
          id: "new-todo",
          type: "text",
          placeholder: "Задание",
        },
        [],
        [{ event: "input", handler: this.props.onAddInputChange }]
      ),
      createElement(
        "button",
        { id: "add-btn", type: "button" },
        "+",
        [{ event: "click", handler: this.props.onAddTask }]
      ),
    ]);
  }
}

class Task extends Component {
  constructor(props) {
    super(props);
    this.state = { isDeleteArmed: false };

    this.onDeleteClick = this.onDeleteClick.bind(this);
    this.onToggleCompleted = this.onToggleCompleted.bind(this);
  }

  update(nextProps) {
    if (nextProps && nextProps.task && this.props.task && nextProps.task.id !== this.props.task.id) {
      this.state.isDeleteArmed = false;
    }

    return super.update(nextProps);
  }

  onDeleteClick() {
    if (!this.state.isDeleteArmed) {
      this.state.isDeleteArmed = true;
      this.update();
      return;
    }

    if (typeof this.props.onDelete === "function") {
      this.props.onDelete(this.props.task.id);
    }
  }

  onToggleCompleted() {
    if (typeof this.props.onToggleCompleted === "function") {
      this.props.onToggleCompleted(this.props.task.id);
    }
  }

  render() {
    const { task } = this.props;

    const labelClass = task.completed
      ? "task-label task-label--completed"
      : "task-label";
    const deleteButtonClass = this.state.isDeleteArmed
      ? "delete-btn delete-btn--armed"
      : "delete-btn";
    const deleteButtonText = "🗑️";

    return createElement("li", { class: "task-item" }, [
      createElement(
        "input",
        {
          type: "checkbox",
          checked: task.completed,
        },
        [],
        [{ event: "change", handler: this.onToggleCompleted }]
      ),
      createElement("label", { class: labelClass }, task.text),
      createElement(
        "button",
        {
          type: "button",
          class: deleteButtonClass,
        },
        deleteButtonText,
        [{ event: "click", handler: this.onDeleteClick }]
      ),
    ]);
  }
}

class TodoList extends Component {
  constructor() {
    super();

    const persistedState = this.loadState();
    this.state = persistedState || {
      tasks: [
        { id: 1, text: "Сделать домашку", completed: false },
        { id: 2, text: "Сделать практику", completed: false },
        { id: 3, text: "Пойти домой", completed: false },
      ],
      newTaskText: "",
    };

    this.nextTaskId = this.getNextTaskId();

    this.onAddTask = this.onAddTask.bind(this);
    this.onAddInputChange = this.onAddInputChange.bind(this);
    this.onDeleteTask = this.onDeleteTask.bind(this);
    this.onToggleTaskCompleted = this.onToggleTaskCompleted.bind(this);
  }

  getNextTaskId() {
    if (!this.state.tasks.length) {
      return 1;
    }

    return (
      Math.max(
        ...this.state.tasks.map((task) =>
          Number.isInteger(task.id) ? task.id : 0
        )
      ) + 1
    );
  }

  loadState() {
    if (typeof localStorage === "undefined") {
      return null;
    }

    try {
      const rawState = localStorage.getItem(STORAGE_KEY);
      if (!rawState) {
        return null;
      }

      const parsedState = JSON.parse(rawState);
      if (!parsedState || !Array.isArray(parsedState.tasks)) {
        return null;
      }

      return {
        tasks: parsedState.tasks
          .filter((task) => task && typeof task.text === "string")
          .map((task, index) => ({
            id: Number.isInteger(task.id) ? task.id : index + 1,
            text: task.text,
            completed: Boolean(task.completed),
          })),
        newTaskText:
          typeof parsedState.newTaskText === "string"
            ? parsedState.newTaskText
            : "",
      };
    } catch (error) {
      return null;
    }
  }

  saveState() {
    if (typeof localStorage === "undefined") {
      return;
    }

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        tasks: this.state.tasks,
        newTaskText: this.state.newTaskText,
      })
    );
  }

  onAddInputChange(event) {
    this.state.newTaskText = event.target.value;
    this.saveState();
  }

  onAddTask() {
    const taskText = this.state.newTaskText.trim();
    if (!taskText) {
      alert("ПИШИ ДАВАЙ");
      return;
    }

    this.state.tasks = [
      ...this.state.tasks,
      {
        id: this.nextTaskId,
        text: taskText,
        completed: false,
      },
    ];
    this.nextTaskId += 1;
    this.state.newTaskText = "";

    this.saveState();
    this.update();
  }

  onDeleteTask(taskId) {
    this.state.tasks = this.state.tasks.filter((task) => task.id !== taskId);
    this.saveState();
    this.update();
  }

  onToggleTaskCompleted(taskId) {
    this.state.tasks = this.state.tasks.map((task) => {
      if (task.id !== taskId) {
        return task;
      }

      return {
        ...task,
        completed: !task.completed,
      };
    });

    this.saveState();
    this.update();
  }

  render() {
    this.beginChildrenRender();

    const addTaskNode = this.renderChild(AddTask, "add-task", {
      value: this.state.newTaskText,
      onAddTask: this.onAddTask,
      onAddInputChange: this.onAddInputChange,
    });

    const taskNodes = this.state.tasks.map((task) =>
      this.renderChild(Task, task.id, {
        task,
        onDelete: this.onDeleteTask,
        onToggleCompleted: this.onToggleTaskCompleted,
      })
    );

    this.finishChildrenRender();

    return createElement("div", { class: "todo-list" }, [
      createElement("h1", {}, "TODO List"),
      addTaskNode,
      createElement("ul", { id: "todos" }, taskNodes),
    ]);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.body.appendChild(new TodoList().getDomNode());
});
