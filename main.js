function interjoin(xs, y) {
  const acc = [];
  let first = true;
  for (const x of xs) {
    if (!first) for (const j of y) acc.push(j);
    for (const i of x) acc.push(i);
    first = false;
  }
  return acc;
}
function elBuilder(element, attrs, children) {
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "text") {
      element.innerText = value;
    } else if (key === "html") {
      element.innerHTML = value;
    } else if (key === "style") {
      for (const [styleKey, styleValue] of Object.entries(value)) {
        element.style[styleKey] = styleValue;
      }
    } else if (key === "class") {
      element.classList.add(...value.split(" "));
    } else if (key === "dataset") {
      for (const [dataKey, dataValue] of Object.entries(value)) {
        element.dataset[dataKey] = dataValue;
      }
    } else if (key.startsWith("on")) {
      const eventName = key.slice(2).toLowerCase();
      element.addEventListener(eventName, value);
    } else {
      element.setAttribute(key, value);
    }
  }
  children.forEach((child) => {
    if (child instanceof Node) {
      element.appendChild(child);
    } else {
      element.appendChild(document.createTextNode(child.toString()));
    }
  });
  return element;
}
const h = (tag, attrs = {}, children = []) =>
  elBuilder(document.createElement(tag), attrs, children);
const m = (tag, attrs = {}, children = []) =>
  elBuilder(
    document.createElementNS("http://www.w3.org/1998/Math/MathML", tag),
    attrs,
    children
  );
const mn = (num) => {
  const mnn = (num) => m("mn", {}, [num]);
  if (num < 0) return row([mo("-"), mnn(-num)]);
  return mnn(num);
};
const mo = (text) => m("mo", {}, [text]);
const mi = (text) => m("mi", {}, [text]);
const mtext = (text) => m("mtext", {}, [text]);
const mspace = (width) => m("mspace", { width }, []);
const row = (els) => m("mrow", {}, els);
const frac = (num, denom) => m("mfrac", {}, [num, denom]);
const bracketed = (left, right, els) => row([mo(left), ...els, mo(right)]);

function Num() {
  return { match: (obj) => obj.Num() };
}
function Prim(op, args) {
  return { op, args, match: (obj) => obj.Prim(op, args) };
}
function Bind(name, id) {
  return { name, id, match: (obj) => obj.Bind(name, id) };
}
function Var(name) {
  return { name, match: (obj) => obj.Var(name) };
}

const lex = (text) => text.split(/\s+/).filter((token) => token.length > 0);
const Ok = (value) => ({ isOk: true, value });
const Err = (error) => ({ isOk: false, error });

const Builtins = {
  "+": {
    arity: 2,
    fn: (a, b) => a + b,
  },
  "-": {
    arity: 2,
    fn: (a, b) => a - b,
  },
  "*": {
    arity: 2,
    fn: (a, b) => a * b,
    name: "×",
  },
  "/": {
    arity: 2,
    fn: (a, b) => a / b,
  },
  "%": {
    arity: 2,
    fn: (a, b) => a % b,
    name: "mod",
  },
};
for (const name of [
  "abs",
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "exp",
  "log",
  "sqrt",
  "pow",
]) {
  Builtins[name] = {
    arity: Math[name].length,
    fn: Math[name],
  };
}
for (const c of ["PI", "E"]) {
  Builtins[c] = {
    arity: 0,
    fn: () => Math[c],
  };
}
Builtins["PI"].name = "π";
Builtins["E"].name = "e";

function interpretOp(op, a, b) {
  if (op === "+") return Ok(a + b);
  if (op === "-") return Ok(a - b);
  if (op === "*") return Ok(a * b);
  if (op === "/") return Ok(a / b);
  return Err("Unknown operator: " + op);
}
class Env {
  constructor() {
    this.vars = new Map();
  }
  set(name, value) {
    this.vars.set(name, value);
  }
  get(name) {
    if (!this.vars.has(name)) return Err(`Unknown variable: "${name}"`);
    return Ok(this.vars.get(name));
  }
}
function interpret(prog) {
  const stack = [];
  const exprs = [];
  const values = [];
  const env = new Env();
  const bail = (error) => ({
    isOk: false,
    stack,
    exprs,
    values,
    env,
    error,
  });
  for (let i = 0; i < prog.length; i++) {
    const token = prog[i];
    if (token.startsWith("=")) {
      // set variable
      const name = token.slice(1);
      if (stack.length === 0) return bail(`No value to assign to: ${name}`);
      const x = stack.pop();
      const value = values[x];

      stack.push(i);
      exprs.push(Bind(name, x));
      values.push(value);
      env.set(name, value);
    } else if (token.startsWith("$")) {
      // push variable
      const name = token.slice(1);
      const result = env.get(name);
      if (!result.isOk) return bail(result.error);
      return bail(`Not implemented: $${name}`);
    } else if (Builtins[token] !== undefined) {
      const builtin = Builtins[token];
      if (stack.length < builtin.arity) {
        return bail(
          `Not enough operands for operator: ${token} (${builtin.arity})`
        );
      }
      const args = builtin.arity > 0 ? stack.splice(-builtin.arity) : [];
      const result = builtin.fn(...args.map((x) => values[x]));
      stack.push(i);
      exprs.push(Prim(token, args));
      values.push(result);
    } else if (!isNaN(parseFloat(token))) {
      const num = parseFloat(token);
      stack.push(i);
      exprs.push(Num());
      values.push(num);
    } else {
      // execute variable
      const name = token;
      const result = env.get(name);
      if (!result.isOk) return bail(result.error);
      stack.push(i);
      exprs.push(Var(name));
      values.push(result.value);
    }
  }
  return {
    isOk: true,
    stack,
    exprs,
    values,
    env,
  };
}
function opPower(op) {
  if (op === "+" || op === "-") return [3, 4];
  if (op === "*" || op === "/" || op === "%") return [5, 6];
  throw new Error("Unknown operator precedence: " + op);
}
function power(tree) {
  return tree.match({
    Num: () => Infinity,
    Var: () => Infinity,
    Bind: () => [1, 2],
    Prim: (op, _) => opPower(op),
  });
}

function $(selector) {
  const el = document.querySelector(selector);
  if (!el) throw new Error("Element not found: " + selector);
  const obj = {
    el,
    on: el.addEventListener.bind(el),
    onDebounce: (event, delay, fn) => {
      let timeoutId = null;
      function debouncedFn(...args) {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => ((timeoutId = null), fn(...args)), delay);
      }
      el.addEventListener(event, debouncedFn);
    },
  };
  return obj;
}
function toURI(code) {
  return code.trim().replace(/\s+/g, "_").trim();
}
function rerender(code) {
  const prog = lex(code);
  const result = interpret(prog);
  $("#exprs").el.innerHTML = "";
  $("#errors").el.innerHTML = "";
  if (!result.isOk) {
    $("#errors").el.textContent = result.error;
  }
  const els = [];
  const powers = [];
  for (let id = 0; id < result.exprs.length; id++) {
    const expr = result.exprs[id];
    const value = result.values[id];
    const power = expr.match({
      Num: () => [Infinity, Infinity],
      Var: () => [Infinity, Infinity],
      Bind: () => [1, 2],
      Prim: (op, args) => {
        if (["+", "-"].includes(op)) return [3, 4];
        if (["*", "/", "%"].includes(op)) return [5, 6];
        if (op === "sqrt") return [7, 8];
        if (op === "pow") return [9, 10];
        return [Infinity, Infinity];
      },
    });
    const el = expr.match({
      Num: () => [mn(value)],
      Prim: (op, args) => {
        const name = Builtins[op].name || op;
        if (["+", "-", "*", "%"].includes(op)) {
          const [a, b] = args;
          const aPre =
            powers[a][1] < power[0] ? [bracketed("(", ")", els[a])] : els[a];
          const bPre =
            powers[b][0] < power[1] ? [bracketed("(", ")", els[b])] : els[b];
          return [...aPre, mo(name), ...bPre];
        } else if (op === "/") {
          return [frac(row(els[args[0]]), row(els[args[1]]))];
        } else if (op === "sqrt") {
          return [m("msqrt", {}, els[args[0]])];
        } else if (op === "pow") {
          const aPre =
            powers[args[0]][1] < power[0]
              ? [bracketed("(", ")", els[args[0]])]
              : els[args[0]];
          return [m("msup", {}, [row(aPre), row(els[args[1]])])];
        } else {
          const argsPre = interjoin(
            args.map((a) => els[a]),
            [mo(",")]
          );
          if (argsPre.length === 0) return [mi(name)];
          return [mi(name), bracketed("(", ")", argsPre)];
        }
      },
      Bind: (name, id) => {
        return [mi(name), mo("≔"), ...els[id]];
      },
      Var: (name) => [mi(name)],
    });
    els.push(el);
    powers.push(power);
  }
  for (const i of result.stack) {
    const el = m("math", { class: "mb3" }, [
      ...els[i],
      mo("="),
      mn(result.values[i]),
    ]);
    $("#exprs").el.appendChild(el);
  }
}
function resize() {
  $("#code").el.style.height = "0px";
  const codeHeight = Math.min(
    $("#code").el.scrollHeight + 2,
    window.innerHeight * 0.5
  );
  const otherHeight = window.innerHeight - codeHeight;
  $("#code").el.style.height = codeHeight + "px";
  $("main").el.style.height = otherHeight + "px";
}

const defaultCode =
  "PI 6 / =x PI 4 / =y 2 x sin * y cos * x y + sin x y - sin + -";
function valueFromURI() {
  if (window.location.hash === "") return defaultCode;
  const hash = window.location.hash.slice(1);
  if (hash === "") return defaultCode;
  return decodeURIComponent(hash).replaceAll("_", " ");
}
window.addEventListener("load", () => {
  $("#code").el.value = valueFromURI();
  setURL();
});
window.addEventListener("resize", resize);

function view() {
  rerender($("#code").el.value.slice(0, $("#code").el.selectionEnd));
}
function setURL() {
  window.location.hash = encodeURIComponent(toURI($("#code").el.value));
}
$("#code").onDebounce("keydown", 25, view);
$("#code").on("click", view);
$("#code").on("touchstart", view);
$("#code").on("input", setURL);
$("#code").on("input", resize);
$("#code").el.value = valueFromURI();

view();
setURL();
resize();
