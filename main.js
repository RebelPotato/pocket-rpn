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
}
const mo = (text) => m("mo", {}, [text]);
const row = (els) => m("mrow", {}, els);
const frac = (num, denom) => m("mfrac", {}, [num, denom]);
const bracketed = (left, right, els) => row([mo(left), ...els, mo(right)]);

function Num(value) {
  const obj = { value, match: (obj) => obj.Num(value) };
  return obj;
}
function Op(op, a, b) {
  const obj = { op, a, b, match: (obj) => obj.Op(op, a, b) };
  return obj;
}

const lex = (text) => text.split(/\s+/).filter((token) => token.length > 0);
const Expr = (tree, value) => ({ tree, value });
const Ok = (value) => ({ isOk: true, value });
const Err = (error) => ({ isOk: false, error });
function interpretOp(op, a, b) {
  if (op === "+") return Ok(a + b);
  if (op === "-") return Ok(a - b);
  if (op === "*") return Ok(a * b);
  if (op === "/") return Ok(a / b);
  return Err("Unknown operator: " + op);
}
function interpret(prog) {
  const exprs = [];
  const bail = (error) => ({
    isOk: false,
    exprs,
    error,
  });
  for (const token of prog) {
    if (["+", "-", "*", "/"].includes(token)) {
      if (exprs.length < 2)
        return bail("Not enough operands for operator: " + token);
      const b = exprs.pop();
      const a = exprs.pop();
      const result = interpretOp(token, a.value, b.value);
      if (!result.isOk) return bail(result.error);
      exprs.push(Expr(Op(token, a.tree, b.tree), result.value));
    } else if (!isNaN(parseFloat(token))) {
      const num = parseFloat(token);
      exprs.push(Expr(Num(num), num));
    } else return bail("Unknown token: " + token);
  }
  return {
    isOk: true,
    exprs,
  };
}
function opPower(op) {
  if (op === "+" || op === "-") return [1, 2];
  if (op === "*" || op === "/") return [3, 4];
  throw new Error("Unknown operator precedence: " + op);
}
function power(tree) {
  return tree.match({
    Num: () => Infinity,
    Op: (op, a, b) => opPower(op),
  });
}
function render(tree) {
  return tree.match({
    Num: (value) => [mn(value)],
    Op: (op, a, b) => {
      const aEls = render(a);
      const bEls = render(b);
      if (op === "/") return [frac(row(aEls), row(bEls))];
      const opChar = op === "*" ? "×" : op;
      const opPre = opPower(op);
      const aPre = power(a)[1] < opPre[0] ? [bracketed("(", ")", aEls)] : aEls;
      const bPre = power(b)[0] < opPre[1] ? [bracketed("(", ")", bEls)] : bEls;
      return [...aPre, mo(opChar), ...bPre];
    },
  });
}

function $(selector) {
  const el = document.querySelector(selector);
  if (!el) throw new Error("Element not found: " + selector);
  const obj = {
    el,
    on: el.addEventListener.bind(el),
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
    console.error(result.error);
    $("#errors").el.textContent = result.error;
  }
  for (let i = 0; i < result.exprs.length; i++) {
    const expr = result.exprs[i];
    const els = render(expr.tree);
    const el = m("math", { class: "mb3" }, [...els, mo("="), mn(expr.value)]);
    $("#exprs").el.appendChild(el);
  }
}
function resize(el) {
  el.style.height = "0px";
  el.style.height = el.scrollHeight + 2 + "px";
}

const defaultCode = "1 2 3 * 4 / - 5 +";
function valueFromURI() {
  if (window.location.hash === "") return defaultCode;
  const hash = window.location.hash.slice(1);
  if (hash === "") return defaultCode;
  return decodeURIComponent(hash).replaceAll("_", " ");
}
window.addEventListener('load', () => {
  $("#code").el.value = valueFromURI();
  view();
});
function view() {
  rerender($("#code").el.value);
  resize($("#code").el);
  window.location.hash = encodeURIComponent(toURI($("#code").el.value));
}
$("#code").on("input", (e) => view());
$("#code").el.value = valueFromURI();
view();
