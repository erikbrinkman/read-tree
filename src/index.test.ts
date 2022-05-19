import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { loremIpsum } from "lorem-ipsum";
import { html, parse, parseFragment } from "parse5";
import { NodeType, treeAdapter } from ".";

describe("parsing", () => {
  test("#parse()", () => {
    const content = `
    <!doctype html>
    <html>
      <head><title>Title</title></head>
      <body>
        <p>This is a really short article</p>
        <img alt="img">
      </body>
    </html>`;
    const parsed = parse(content, { treeAdapter });

    expect(parsed.title).toBe("Title");
    expect(parsed.body.children).toHaveLength(2);
    expect(parsed.body.ownerDocument).toBe(parsed);
  });

  test("#parseFragment()", () => {
    const content = `<p>This is a really short article</p>`;
    const parsed = parseFragment(content, { treeAdapter });
    expect(parsed.nodeName).toBe("#document-fragment");
    const [p] = parsed.getElementsByTagName("p");
    expect(() => p?.ownerDocument).toThrow("fragment");
  });

  test("escaping", () => {
    const content = `<div><p data-test="<&quot;>">&lt;H&amp;M&gt;</p></div>`;
    const parsed = parseFragment(content, { treeAdapter });
    const [div] = parsed.getElementsByTagName("div");
    const [p] = div?.children ?? [];
    const [text] = p?.childNodes ?? [];
    expect(p?.textContent).toBe("<H&M>");
    if (text?.nodeType !== NodeType.Text) throw new Error("invalid node");
    expect(text?.textContent).toBe("<H&M>");
    expect(p?.getAttribute("data-test")).toBe('<">');
    expect(div?.innerHTML).toBe(`<p data-test="<&quot;>">&lt;H&amp;M&gt;</p>`);
  });

  test("#getAttribute()", () => {
    const content = `<p data-missing="" data-test="val">This is a really short article</p>`;
    const parsed = parseFragment(content, { treeAdapter });
    const [p] = parsed.getElementsByTagName("p");
    expect(p?.getAttribute("data-test")).toBe("val");
  });

  test("#removeAttribute()", () => {
    const content = `<p data-test="val">This is a really short article</p>`;
    const parsed = parseFragment(content, { treeAdapter });
    const [p] = parsed.getElementsByTagName("p");
    expect(p.hasAttribute("data-test")).toBe(true);
    p?.removeAttribute("data-test");
    expect(p.hasAttribute("data-test")).toBe(false);
  });

  test("id & class & src & srcset", () => {
    const content = `<img><div></div>`;
    const parsed = parseFragment(content, { treeAdapter });
    const [img, div] = parsed.children;

    expect(img?.src).toBe("");
    img.src = "new src";
    expect(img?.src).toBe("new src");
    expect(img?.getAttribute("src")).toBe("new src");
    img.src = undefined;
    expect(img.src).toBe("undefined");

    expect(img.srcset).toBe("");
    img.srcset = "new srcset";
    expect(img.srcset).toBe("new srcset");
    expect(img?.getAttribute("srcset")).toBe("new srcset");
    img.srcset = undefined;
    expect(img.srcset).toBe("undefined");

    expect(div?.src).toBeUndefined();
    div.src = "src";
    expect(div?.src).toBe("src");
    expect(div?.getAttribute("src")).toBeNull();

    expect(div?.srcset).toBeUndefined();
    div.srcset = "srcset";
    expect(div?.srcset).toBe("srcset");
    expect(div?.getAttribute("srcset")).toBeNull();

    expect(div?.className).toBe("");
    expect(div.getAttribute("class")).toBeNull();
    div.className = "my-class";
    expect(div?.className).toBe("my-class");
    expect(div.getAttribute("class")).toBe("my-class");

    expect(div?.id).toBe("");
    expect(div.getAttribute("id")).toBeNull();
    div.id = "my-id";
    expect(div?.id).toBe("my-id");
    expect(div.getAttribute("id")).toBe("my-id");
  });

  test("#innerHTML", () => {
    const content = `
    <!doctype html>
    <html>
      <head><title>Title</title></head>
      <body>
        <!--comment-->
        <img src="src">
        <p disabled>This is a really short article</p>
      </body>
    </html>`;
    const parsed = parse(content, { treeAdapter });

    let doctype;
    for (const node of parsed.childNodes) {
      if (treeAdapter.isDocumentTypeNode(node)) {
        doctype = node;
        break;
      }
    }
    if (!doctype) throw new Error("no doctype");

    parsed.body.appendChild(doctype);
    expect(parsed.body.innerHTML).toBe(`
        <!--comment-->
        <img src="src"/>
        <p disabled>This is a really short article</p>
      
    <!doctype html>`);
  });

  test("#firstChild()", () => {
    const content = `<img>`;
    const parsed = parseFragment(content, { treeAdapter });
    const [img] = parsed.getElementsByTagName("img");
    expect(img.firstChild).toBeNull();
  });

  test("#replaceChild()", () => {
    const content = `<img><p data-test="val">This is a really short article</p><div></div>`;
    const parsed = parseFragment(content, { treeAdapter });
    const [p] = parsed.getElementsByTagName("p");
    const [img] = parsed.getElementsByTagName("img");
    const [div] = parsed.getElementsByTagName("div");

    expect(parsed.children).toHaveLength(3);
    parsed.replaceChild(img, div);
    expect(parsed.children).toHaveLength(2);
    expect(img.parentNode).toBe(parsed);

    expect(p.children).toHaveLength(0);
    p?.replaceChild(img, img);
    expect(p.children).toHaveLength(1);
  });

  test("#appendChild()", () => {
    const content = `<p data-test="val">This is a really short article</p>`;
    const parsed = parseFragment(content, { treeAdapter });
    const [p] = parsed.getElementsByTagName("p");
    const img = treeAdapter.createElement("img", html.NS.HTML, []);
    p.removeChild(img);
    expect(img.parentNode).toBeNull();
    p?.appendChild(img);
    expect(p.childNodes).toHaveLength(2);
  });

  test("#nextSibling()", () => {
    const content = `<div></div>Text<div></div>`;
    const parsed = parseFragment(content, { treeAdapter });
    const [d1, txt, d2] = parsed.childNodes;
    expect(d1.nextSibling).toBe(txt);
    expect(txt.nextSibling).toBe(d2);
    expect(d2.nextSibling).toBeNull();

    const img = treeAdapter.createElement("img", html.NS.HTML, []);
    expect(img.nextSibling).toBeNull();
  });

  test("#nextElementSibling()", () => {
    const img = treeAdapter.createElement("img", html.NS.HTML, []);
    expect(img.nextElementSibling).toBeNull();
  });

  test("rigorous parsing", () => {
    const content = `
    <!doctype html>
    <html>
      <head></head>
      <body>
        <p>Irure Lorem sit minim velit veniam do amet ut laboris. Ut <a href="#">veniam</a> nulla minim sunt. Ut non nisi et veniam consequat dolor enim consequat enim ex laborum laborum exercitation. Ullamco exercitation commodo officia incididunt nostrud in deserunt.</p>
        <p>Ea ad reprehenderit in mollit est ipsum elit. Dolore dolor quis proident excepteur nulla nulla elit aute. Irure duis esse deserunt exercitation minim magna eu cupidatat adipisicing mollit nisi nostrud dolor. Dolor consequat eu est ea consectetur magna enim ea id elit aliquip duis do. Et ad fugiat id sunt cupidatat ex excepteur amet duis laborum tempor proident eiusmod occaecat. Magna ea minim consequat aliqua cupidatat deserunt eiusmod. Ipsum veniam sunt anim officia est.</p>
      </body>
    </html>`;

    const parsed = parse(content, { treeAdapter });

    const [doctype, html] = parsed.childNodes;
    expect(doctype.nodeType).toBe(NodeType.DocumentType);
    expect(doctype.parentNode).toBe(parsed);
    expect(html).toBe(parsed.documentElement);

    expect(parsed.documentElement.children).toHaveLength(2);
    const [head, , body] = parsed.documentElement.childNodes;
    expect(head).toBe(parsed.head);
    expect(head.parentNode).toBe(html);
    expect(body).toBe(parsed.body);
    expect(body.parentNode).toBe(html);

    expect(parsed.body.children).toHaveLength(2);
    const [, p1, , p2] = parsed.body.childNodes;
    expect(p1.nodeType === NodeType.Element && p1.tagName).toBe("P");
    expect(p1.parentNode).toBe(body);
    expect(p2.nodeType === NodeType.Element && p2.tagName).toBe("P");
    expect(p2.parentNode).toBe(body);
  });
});

describe("adapter", () => {
  const content = `
  <!doctype html PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">
  <html>
    <head>
      <title>Title</title>
      <!-- header comment -->
    </head>
    <body class="body-class">
      <p data-test="">This is a really short article</p>
      <template id="template">
        <p>extra paragraph</p>
      </template>
    </body>
  </html>`;
  const doc = parse(content, { treeAdapter, sourceCodeLocationInfo: true });

  test("null owner document", () => {
    const node = treeAdapter.createElement("p", html.NS.HTML, []);
    expect(() => node.ownerDocument).toThrow("null");
  });

  test("#getDocumentMode()", () => {
    expect(treeAdapter.getDocumentMode(doc)).toBe(html.DOCUMENT_MODE.NO_QUIRKS);
  });

  test("#detachNode()", () => {
    const content = `
    <!doctype html>
    <html>
      <head><title>Title</title></head>
    </html>`;
    const parsed = parse(content, { treeAdapter });
    // need to detach to throw
    treeAdapter.detachNode(parsed.head);
    expect(() => parsed.head).toThrow("didn't have a head");
    expect(parsed.title).toBe("");
    treeAdapter.detachNode(parsed.body);
    expect(() => parsed.body).toThrow("didn't have a body");
    treeAdapter.detachNode(parsed.documentElement);
    expect(() => parsed.documentElement).toThrow("didn't have an html element");

    const node = treeAdapter.createElement("p", html.NS.HTML, []);
    expect(node.parentNode).toBeNull();
    treeAdapter.detachNode(node);
    expect(node.parentNode).toBeNull();

    // invalid structure
    node.parentNode = parsed;
    treeAdapter.detachNode(node);
    expect(node.parentNode).toBeNull();
  });

  test("#insertBefore()", () => {
    const root = treeAdapter.createElement("div", html.NS.HTML, []);
    const added = treeAdapter.createElement("div", html.NS.HTML, []);
    treeAdapter.insertBefore(root, added, added);
    expect(root.children).toHaveLength(1);
  });

  test("#insertTextBefore()", () => {
    const content = `<p data-test="val">This is a really short article</p>`;
    const parsed = parseFragment(content, { treeAdapter });
    const [p] = parsed.getElementsByTagName("p");
    if (!p || !treeAdapter.isElementNode(p))
      throw new Error("didn't get element");
    const ref = p.firstChild!;
    treeAdapter.insertTextBefore(p, "extra", ref);
    treeAdapter.insertTextBefore(p, " plus ", ref);
    expect(p.textContent).toBe("extra plus This is a really short article");
  });

  test("#adoptAttributes()", () => {
    const content = `<p data-test="val">This is a really short article</p>`;
    const parsed = parseFragment(content, { treeAdapter });
    const [p] = parsed.getElementsByTagName("p");
    if (!p || !treeAdapter.isElementNode(p))
      throw new Error("didn't get element");
    treeAdapter.adoptAttributes(p, [
      { name: "data-new", value: "other" },
      { name: "data-test", value: "new val" },
    ]);
    const [first, second] = p.attributes;
    expect(first?.name).toBe("data-test");
    expect(first?.value).toBe("val");
    expect(second?.name).toBe("data-new");
    expect(second?.value).toBe("other");
  });

  test("#getFirstChild()", () => {
    expect(treeAdapter.getFirstChild(doc.body)).not.toBeNull();
  });

  test("#getParentNode()", () => {
    expect(treeAdapter.getParentNode(doc.body)).toBe(doc.documentElement);
  });

  test("#getAttrList()", () => {
    const [cls] = treeAdapter.getAttrList(doc.body);
    expect(cls?.name).toBe("class");
    expect(cls?.value).toBe("body-class");
  });

  test("#getTextNodeContent()", () => {
    const [p] = doc.getElementsByTagName("p");
    const [text] = p?.childNodes ?? [];
    if (!text || !treeAdapter.isTextNode(text))
      throw new Error("not text node");
    expect(treeAdapter.getTextNodeContent(text)).toBe(
      "This is a really short article"
    );
  });

  test("#getCommentNodeContent()", () => {
    let comment;
    for (const node of doc.head.childNodes) {
      if (treeAdapter.isCommentNode(node)) {
        comment = node;
        break;
      }
    }
    if (!comment) throw new Error("no comment node");
    expect(treeAdapter.getCommentNodeContent(comment)).toBe(" header comment ");
  });

  test("#getDocumentTypeNode*()", () => {
    const content = `<!doctype html>`;
    const parsed = parse(content, { treeAdapter });
    treeAdapter.setDocumentType(parsed, "a", "b", "c");

    let doctype;
    for (const node of parsed.childNodes) {
      if (treeAdapter.isDocumentTypeNode(node)) {
        doctype = node;
        break;
      }
    }
    if (!doctype) throw new Error("no doctype");

    expect(treeAdapter.getDocumentTypeNodeName(doctype)).toBe("a");
    expect(treeAdapter.getDocumentTypeNodePublicId(doctype)).toBe("b");
    expect(treeAdapter.getDocumentTypeNodeSystemId(doctype)).toBe("c");
  });

  test("#isCommentNode()", () => {
    expect(doc.head.childNodes.some((n) => treeAdapter.isCommentNode(n))).toBe(
      true
    );
    expect(doc.body.childNodes.some((n) => treeAdapter.isCommentNode(n))).toBe(
      false
    );
  });

  test("#isElementNode()", () => {
    expect(treeAdapter.isElementNode(doc)).toBe(false);
    expect(treeAdapter.isElementNode(doc.documentElement)).toBe(true);
  });
});

describe("readability", () => {
  test("minimal", () => {
    const opts = { charThreshold: 0 };
    const content = `
    <!doctype html>
    <html>
      <meta>
      <head><title>Title</title></head>
      <body>
        <p>Irure Lorem sit minim velit veniam do amet ut laboris. Ut veniam nulla minim sunt. Ut non nisi et veniam consequat dolor enim consequat enim ex laborum laborum exercitation. Ullamco exercitation commodo officia incididunt nostrud in deserunt.</p>
        <p>Ea ad reprehenderit in mollit est ipsum elit. Dolore dolor quis proident excepteur nulla nulla elit aute. Irure duis esse deserunt exercitation minim magna eu cupidatat adipisicing mollit nisi nostrud dolor. Dolor consequat eu est ea consectetur magna enim ea id elit aliquip duis do. Et ad fugiat id sunt cupidatat ex excepteur amet duis laborum tempor proident eiusmod occaecat. Magna ea minim consequat aliqua cupidatat deserunt eiusmod. Ipsum veniam sunt anim officia est.</p>
      </body>
    </html>`;
    const dom = new JSDOM(content);
    const expected = new Readability(dom.window.document, opts).parse();

    const parsed = parse(content, { treeAdapter });
    const actual = new Readability(parsed as unknown as Document, opts).parse();
    expect(actual).not.toBeNull();
    expect(actual?.title).toBe("Title");
    expect(actual?.textContent).toContain("reprehenderit");
    expect(actual?.content).toContain("<p>Ea ad reprehenderit");
    expect(actual?.content).toBe(expected?.content);
  });

  test("advanced", () => {
    const opts = { charThreshold: 0 };
    const [a, b, c, d, e] = loremIpsum({
      count: 5,
      units: "paragraphs",
    })
      .split("\n")
      .map((p) => `<p>${p}</p>`);
    const content = `
    <!doctype html>
    <html>
      <head></head>
      <body>
        ${a}
        ${b}
        ${c}
        <img src="test.png" srcset="large.png 100w">
        ${d}
        ${e}
      </body>
    </html>`;
    const dom = new JSDOM(content);
    const expected = new Readability(dom.window.document, opts).parse();

    const parsed = parse(content, { treeAdapter });
    const actual = new Readability(parsed as unknown as Document, opts).parse();
    expect(actual).not.toBeNull();
    expect(actual?.content).toContain(
      `<img src="test.png" srcset="large.png 100w"/>`
    );
    expect(actual?.content).toBe(
      expected?.content?.replace(
        `<img src="test.png" srcset="large.png 100w">`,
        `<img src="test.png" srcset="large.png 100w"/>`
      )
    );
  });

  test("links", () => {
    const opts = { charThreshold: 0 };
    const content = `
    <!doctype html>
    <html>
      <head></head>
      <body>
        <p>Irure Lorem sit minim velit veniam do amet ut laboris. Ut <a href="#">veniam</a> nulla minim sunt. Ut non nisi et veniam consequat dolor enim consequat enim ex laborum laborum exercitation. Ullamco exercitation commodo officia incididunt nostrud in deserunt.</p>
        <p>Ea ad reprehenderit in mollit est ipsum elit. Dolore dolor quis proident excepteur nulla nulla elit aute. Irure duis esse deserunt exercitation minim magna eu cupidatat adipisicing mollit nisi nostrud dolor. Dolor consequat eu est ea consectetur magna enim ea id elit aliquip duis do. Et ad fugiat id sunt cupidatat ex excepteur amet duis laborum tempor proident eiusmod occaecat. Magna ea minim consequat aliqua cupidatat deserunt eiusmod. Ipsum veniam sunt anim officia est.</p>
      </body>
    </html>`;
    const dom = new JSDOM(content);
    const expected = new Readability(dom.window.document, opts).parse();

    const parsed = parse(content, { treeAdapter });
    const actual = new Readability(parsed as unknown as Document, opts).parse();
    expect(actual).not.toBeNull();
    expect(actual?.content).toContain(`<a href="#">veniam</a>`);
    expect(actual?.content).toBe(expected?.content);
  });
});
