const {
  findFieldByCfg,
  findByLabelFor,
  findByAriaLabel,
  findByPlaceholder,
  findByLabelWrap,
  findByTextNearCheckbox,
  detectWidget,
  FIELD_STRATEGIES,
} = require("../src/selectors.js");

beforeEach(() => {
  document.body.innerHTML = "";
});

// ── FIELD_STRATEGIES registry ────────────────────────────────────

describe("FIELD_STRATEGIES", () => {
  it("has 5 strategies in correct order", () => {
    expect(FIELD_STRATEGIES).toHaveLength(5);
    expect(FIELD_STRATEGIES.map((s) => s.name)).toEqual(["labelFor", "ariaLabel", "placeholder", "labelWrap", "textNearCheckbox"]);
  });

  it("each strategy has a find function", () => {
    FIELD_STRATEGIES.forEach((s) => {
      expect(typeof s.find).toBe("function");
    });
  });
});

// ── findByLabelFor ───────────────────────────────────────────────

describe("findByLabelFor", () => {
  it("finds input by matching label text", () => {
    document.body.innerHTML = `
      <label for="field1">Group Name</label>
      <input id="field1" type="text">
    `;
    const el = findByLabelFor(["group name"], new Set());
    expect(el).not.toBeNull();
    expect(el.id).toBe("field1");
  });

  it("matches partial label text", () => {
    document.body.innerHTML = `
      <label for="field1">Enter your group name here</label>
      <input id="field1" type="text">
    `;
    const el = findByLabelFor(["group name"], new Set());
    expect(el).not.toBeNull();
    expect(el.id).toBe("field1");
  });

  it("returns null when no label matches", () => {
    document.body.innerHTML = `
      <label for="field1">Email</label>
      <input id="field1" type="text">
    `;
    expect(findByLabelFor(["group name"], new Set())).toBeNull();
  });

  it("skips excluded elements", () => {
    document.body.innerHTML = `
      <label for="field1">Group Name</label>
      <input id="field1" type="text">
    `;
    const el = document.getElementById("field1");
    expect(findByLabelFor(["group name"], new Set([el]))).toBeNull();
  });

  it("skips labels without for attribute", () => {
    document.body.innerHTML = `
      <label>Group Name</label>
      <input id="field1" type="text">
    `;
    expect(findByLabelFor(["group name"], new Set())).toBeNull();
  });
});

// ── findByAriaLabel ──────────────────────────────────────────────

describe("findByAriaLabel", () => {
  it("finds element by aria-label", () => {
    document.body.innerHTML = `
      <input id="f1" aria-label="Group Name" type="text">
    `;
    const el = findByAriaLabel(["group name"], new Set());
    expect(el).not.toBeNull();
    expect(el.id).toBe("f1");
  });

  it("matches partial aria-label", () => {
    document.body.innerHTML = `
      <input id="f1" aria-label="Enter group name" type="text">
    `;
    const el = findByAriaLabel(["group name"], new Set());
    expect(el).not.toBeNull();
  });

  it("returns null when no match", () => {
    document.body.innerHTML = `
      <input id="f1" aria-label="Email" type="text">
    `;
    expect(findByAriaLabel(["group name"], new Set())).toBeNull();
  });

  it("skips excluded elements", () => {
    document.body.innerHTML = `
      <input id="f1" aria-label="Group Name" type="text">
    `;
    const el = document.getElementById("f1");
    expect(findByAriaLabel(["group name"], new Set([el]))).toBeNull();
  });
});

// ── findByPlaceholder ────────────────────────────────────────────

describe("findByPlaceholder", () => {
  it("finds input by placeholder", () => {
    document.body.innerHTML = `
      <input id="f1" placeholder="Enter group name" type="text">
    `;
    const el = findByPlaceholder(["group name"], new Set());
    expect(el).not.toBeNull();
    expect(el.id).toBe("f1");
  });

  it("finds textarea by placeholder", () => {
    document.body.innerHTML = `
      <textarea id="t1" placeholder="Business justification"></textarea>
    `;
    const el = findByPlaceholder(["business justification"], new Set());
    expect(el).not.toBeNull();
    expect(el.id).toBe("t1");
  });

  it("returns null when no match", () => {
    document.body.innerHTML = `
      <input id="f1" placeholder="Email" type="text">
    `;
    expect(findByPlaceholder(["group name"], new Set())).toBeNull();
  });

  it("skips excluded elements", () => {
    document.body.innerHTML = `
      <input id="f1" placeholder="Group Name" type="text">
    `;
    const el = document.getElementById("f1");
    expect(findByPlaceholder(["group name"], new Set([el]))).toBeNull();
  });
});

// ── findByLabelWrap ──────────────────────────────────────────────

describe("findByLabelWrap", () => {
  it("finds checkbox wrapped inside a label without for attribute", () => {
    document.body.innerHTML = `
      <label>
        <input type="checkbox" id="cb1">
        Accept Terms
      </label>
    `;
    const el = findByLabelWrap(["accept terms"], new Set());
    expect(el).not.toBeNull();
    expect(el.id).toBe("cb1");
  });

  it("finds radio wrapped inside a label", () => {
    document.body.innerHTML = `
      <label>
        <input type="radio" id="r1" name="opt">
        Option A
      </label>
    `;
    const el = findByLabelWrap(["option a"], new Set());
    expect(el).not.toBeNull();
    expect(el.id).toBe("r1");
  });

  it("finds role=switch inside a label", () => {
    document.body.innerHTML = `
      <label>
        <span role="switch" id="sw1" aria-checked="false"></span>
        Dark Mode
      </label>
    `;
    const el = findByLabelWrap(["dark mode"], new Set());
    expect(el).not.toBeNull();
    expect(el.id).toBe("sw1");
  });

  it("skips labels with for attribute (handled by labelFor)", () => {
    document.body.innerHTML = `
      <label for="cb1">
        <input type="checkbox" id="cb1">
        Accept Terms
      </label>
    `;
    expect(findByLabelWrap(["accept terms"], new Set())).toBeNull();
  });

  it("returns null when no text matches", () => {
    document.body.innerHTML = `
      <label>
        <input type="checkbox" id="cb1">
        Subscribe
      </label>
    `;
    expect(findByLabelWrap(["accept terms"], new Set())).toBeNull();
  });

  it("skips excluded elements", () => {
    document.body.innerHTML = `
      <label>
        <input type="checkbox" id="cb1">
        Accept Terms
      </label>
    `;
    const el = document.getElementById("cb1");
    expect(findByLabelWrap(["accept terms"], new Set([el]))).toBeNull();
  });

  it("matches nested text (e.g. text in a child element)", () => {
    document.body.innerHTML = `
      <label>
        <input type="checkbox" id="cb1">
        <p>I <strong>acknowledge</strong> this action is audited</p>
      </label>
    `;
    const el = findByLabelWrap(["acknowledge"], new Set());
    expect(el).not.toBeNull();
    expect(el.id).toBe("cb1");
  });
});

// ── findByTextNearCheckbox ───────────────────────────────────────

describe("findByTextNearCheckbox", () => {
  it("finds checkbox near matching text in a common ancestor", () => {
    document.body.innerHTML = `
      <div>
        <input type="checkbox" id="cb1">
        <span>Enable notifications</span>
      </div>
    `;
    const el = findByTextNearCheckbox(["enable notifications"], new Set());
    expect(el).not.toBeNull();
    expect(el.id).toBe("cb1");
  });

  it("walks up multiple levels to find checkbox", () => {
    document.body.innerHTML = `
      <div class="outer">
        <div class="inner">
          <input type="checkbox" id="cb1">
        </div>
        <div class="text">
          <p>Accept the agreement</p>
        </div>
      </div>
    `;
    const el = findByTextNearCheckbox(["accept the agreement"], new Set());
    expect(el).not.toBeNull();
    expect(el.id).toBe("cb1");
  });

  it("finds role=switch near text", () => {
    document.body.innerHTML = `
      <div>
        <span>Dark Mode</span>
        <div role="switch" id="sw1" aria-checked="false"></div>
      </div>
    `;
    const el = findByTextNearCheckbox(["dark mode"], new Set());
    expect(el).not.toBeNull();
    expect(el.id).toBe("sw1");
  });

  it("returns null when no text matches", () => {
    document.body.innerHTML = `
      <div>
        <input type="checkbox" id="cb1">
        <span>Subscribe</span>
      </div>
    `;
    expect(findByTextNearCheckbox(["accept terms"], new Set())).toBeNull();
  });

  it("skips excluded elements", () => {
    document.body.innerHTML = `
      <div>
        <input type="checkbox" id="cb1">
        <span>Enable notifications</span>
      </div>
    `;
    const el = document.getElementById("cb1");
    expect(findByTextNearCheckbox(["enable notifications"], new Set([el]))).toBeNull();
  });

  it("returns null when no checkbox exists near text", () => {
    document.body.innerHTML = `
      <div>
        <span>Enable notifications</span>
        <input type="text" id="t1">
      </div>
    `;
    expect(findByTextNearCheckbox(["enable notifications"], new Set())).toBeNull();
  });
});

// ── detectWidget ─────────────────────────────────────────────────

describe("detectWidget", () => {
  it("returns select2Container for Select2 elements", () => {
    document.body.innerHTML = `
      <select id="sel1" class="select2-offscreen"></select>
      <div id="s2id_sel1" class="select2-container"></div>
    `;
    const el = document.getElementById("sel1");
    const result = detectWidget(el);
    expect(result.el).toBe(el);
    expect(result.select2Container).not.toBeNull();
    expect(result.select2Container.id).toBe("s2id_sel1");
  });

  it("returns null select2Container for non-Select2 elements", () => {
    document.body.innerHTML = `<input id="f1" type="text">`;
    const el = document.getElementById("f1");
    const result = detectWidget(el);
    expect(result.el).toBe(el);
    expect(result.select2Container).toBeNull();
  });

  it("returns null select2Container when container not found", () => {
    document.body.innerHTML = `<select id="sel1" class="select2-offscreen"></select>`;
    const el = document.getElementById("sel1");
    const result = detectWidget(el);
    expect(result.el).toBe(el);
    expect(result.select2Container).toBeNull();
  });
});

// ── findFieldByCfg (integration) ─────────────────────────────────

describe("findFieldByCfg", () => {
  it("returns null for empty labelMatch", () => {
    expect(findFieldByCfg({ labelMatch: [] })).toBeNull();
  });

  it("returns null for missing labelMatch", () => {
    expect(findFieldByCfg({})).toBeNull();
  });

  it("finds by label first (strategy priority)", () => {
    document.body.innerHTML = `
      <label for="byLabel">Group Name</label>
      <input id="byLabel" type="text">
      <input id="byAria" aria-label="Group Name" type="text">
      <input id="byPh" placeholder="Group Name" type="text">
    `;
    const result = findFieldByCfg({ labelMatch: ["group name"] });
    expect(result).not.toBeNull();
    expect(result.el.id).toBe("byLabel");
  });

  it("falls back to aria-label when no label match", () => {
    document.body.innerHTML = `
      <input id="byAria" aria-label="Group Name" type="text">
      <input id="byPh" placeholder="Group Name" type="text">
    `;
    const result = findFieldByCfg({ labelMatch: ["group name"] });
    expect(result).not.toBeNull();
    expect(result.el.id).toBe("byAria");
  });

  it("falls back to placeholder when no label or aria match", () => {
    document.body.innerHTML = `
      <input id="byPh" placeholder="Group Name" type="text">
    `;
    const result = findFieldByCfg({ labelMatch: ["group name"] });
    expect(result).not.toBeNull();
    expect(result.el.id).toBe("byPh");
  });

  it("respects exclude set", () => {
    document.body.innerHTML = `
      <label for="f1">Group Name</label>
      <input id="f1" type="text">
    `;
    const el = document.getElementById("f1");
    const result = findFieldByCfg({ labelMatch: ["group name"] }, new Set([el]));
    expect(result).toBeNull();
  });

  it("returns widget detection result", () => {
    document.body.innerHTML = `
      <label for="sel1">Group Name</label>
      <select id="sel1" class="select2-offscreen"></select>
      <div id="s2id_sel1"></div>
    `;
    const result = findFieldByCfg({ labelMatch: ["group name"] });
    expect(result).not.toBeNull();
    expect(result.select2Container).not.toBeNull();
  });
});
