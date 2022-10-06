/**
 * A tree adapter for parse5 that creates objects that work with \@mozilla/readability
 *
 * @example
 * ```ts
 * import { Readability } from "@mozilla/readability";
 * import { parse } from "parse5";
 * import { treeAdapter } from "read-tree";
 * const doc = parse(content, { treeAdapter });
 * const { content } = new Readability(parsed as unknown as Document).parse();
 * ```
 *
 * @packageDocumentation
 */
import { html, Token, TreeAdapter, TreeAdapterTypeMap } from "parse5";

// ---------------------------- //
// Interfaces for element types //
// ---------------------------- //

/**
 * nodeType https://developer.mozilla.org/en-US/docs/Web/API/Node/nodeType
 *
 * @remarks this is constant object enum because typedoc is weird about documentation
 */
export const NodeType = {
  /** element type */
  Element: 1,
  /** attribute type */
  Attribute: 2,
  /** text type */
  Text: 3,
  /** cdata type */
  Cdata: 4,
  /** processing instruction type */
  ProcessingInstruction: 7,
  /** comment type */
  Comment: 8,
  /** document type */
  Document: 9,
  /** document type type */
  DocumentType: 10,
  /** document fragment type */
  DocumentFragment: 11,
} as const;

/**
 * the document mode
 *
 * @see {@link https://dom.spec.whatwg.org/#concept-document-limited-quirks}
 */
export type DocumentMode = "no-quirks" | "quirks" | "limited-quirks";

/** the node namespace */
export type Namespace =
  | "http://www.w3.org/1999/xhtml"
  | "http://www.w3.org/1998/Math/MathML"
  | "http://www.w3.org/2000/svg"
  | "http://www.w3.org/1999/xlink"
  | "http://www.w3.org/XML/1998/namespace"
  | "http://www.w3.org/2000/xmlns/";

/** element attribute */
export type Attribute = Token.Attribute;

/** element location with extra info */
export type ElementLocation = Token.ElementLocation;

/** code location */
export type Location = Token.Location;

/** a node with children */
export interface HasChildren {
  /** the node's children */
  childNodes: ChildNode[];
}

/** generic parent */
export interface BaseParent extends HasChildren {
  /** the first child node */
  firstChild: ChildNode | null;

  /** all children elements */
  children: Element[];

  /** first child element */
  firstElementChild: Element | null;

  /** append a child */
  appendChild(child: ChildNode): void;

  /** replace `child` with `replacement` */
  replaceChild(replacement: ChildNode, child: ChildNode): void;

  /** remove the child node */
  removeChild(child: ChildNode): void;

  /** mock of standard getElementsByTagName */
  getElementsByTagName(tag: string): Element[];
}

/** a node with a parent */
export interface HasParent {
  /** parent node */
  parentNode: ParentNode | null;
}

/** generic child */
export interface BaseChild extends HasParent {
  /** get the owning document */
  ownerDocument: Document;

  /** the next sibling node in order */
  nextSibling: ChildNode | null;

  /** next sibling element from this node */
  nextElementSibling: Element | null;
}

/**
 * a document
 *
 * This represents a combination of the minimum document required by parse5,
 * and the minimum document required by Readability.
 *
 * @remarks Because Readability requires {@link Element#ownerDocument}, the easiest way
 * to implement this was to have new nodes created with their parent pointing
 * to document, but that technically violates the structure.
 */
export interface Document extends BaseParent {
  /** nodeName */
  readonly nodeName: "#document";

  /** nodeType */
  readonly nodeType: typeof NodeType.Document;

  /** document mode */
  mode: DocumentMode;

  /** comment source code location info: available if location info is enabled */
  sourceCodeLocation?: Location | null;

  /** the document (html) element  */
  documentElement: Element;

  /** the head element */
  head: Element;

  /** the body element */
  body: Element;

  /** the header title */
  title: string;

  /** create a new element */
  createElement(tagName: string): Element;
}

/** a document fragment */
export interface DocumentFragment extends BaseParent {
  /** nodeName */
  readonly nodeName: "#document-fragment";

  /** nodeType */
  readonly nodeType: typeof NodeType.DocumentFragment;

  /** fragment source code location info: available if location info is enabled */
  sourceCodeLocation?: Location | null;
}

/** an html element */
export interface Element extends BaseParent, BaseChild {
  /** nodeName: uppercase */
  readonly nodeName: string;

  /** nodeType */
  readonly nodeType: typeof NodeType.Element;

  /** element tag name: uppercase */
  readonly tagName: string;

  /** element local name: lowercase */
  readonly localName: string;

  /** element attributes */
  attributes: Attribute[];

  /** element namespace */
  namespaceURI: Namespace;

  /** element source code location info, with attributes: available if location info is enabled */
  sourceCodeLocation?: ElementLocation | null;

  /** has an attribute */
  hasAttribute(attribute: string): boolean;

  /** get an attribute */
  getAttribute(attribute: string): string | null;

  /** set an attribute */
  setAttribute(attribute: string, value: string): void;

  /** remove an attribute */
  removeAttribute(attribute: string): void;

  /** node id */
  id?: string;

  /** class */
  className: string;

  /** src */
  src?: string;

  /** srcset */
  srcset?: string;

  /** the innerHTML */
  innerHTML: string;

  /** text content */
  textContent: string;
}

/** comment node */
export interface CommentNode extends BaseChild {
  /** nodeName */
  readonly nodeName: "#comment";

  /** nodeType */
  readonly nodeType: typeof NodeType.Comment;

  /** childNodes */
  readonly childNodes: readonly [];

  /** comment text */
  data: string;

  /** comment source code location info: available if location info is enabled */
  sourceCodeLocation?: Location | null;
}

/** a text node */
export interface TextNode extends BaseChild {
  /** nodeName */
  readonly nodeName: "#text";

  /** nodeType */
  readonly nodeType: typeof NodeType.Text;

  /** childNodes */
  readonly childNodes: readonly [];

  /** the text content */
  value: string;

  /** text source code location info: available if location info is enabled */
  sourceCodeLocation?: Location | null;

  /** text content */
  textContent: string;
}

/** a template node */
export interface Template extends Element {
  /** nodeName */
  nodeName: "TEMPLATE";

  /** tag name for templates */
  tagName: "TEMPLATE";

  /** the content of a `template` tag */
  content: DocumentFragment;
}

/** the doctype element */
export interface DocumentType extends BaseChild {
  /** nodeName */
  nodeName: string;

  /** nodeType */
  nodeType: typeof NodeType.DocumentType;

  /** childNodes */
  readonly childNodes: readonly [];

  /** document type name */
  name: string;

  /** document type public identifier */
  publicId: string;

  /** document type system identifier */
  systemId: string;

  /** document type source code location info: available if location info is enabled */
  sourceCodeLocation?: Location | null;
}

/** any parent node */
export type ParentNode = Document | DocumentFragment | Element;

/** any child node */
export type ChildNode = Element | CommentNode | TextNode | DocumentType;

/** all nodes */
export type Node = ParentNode | ChildNode;

// -------------- //
// Implementation //
// -------------- //

/** depth first search */
function* dfs(...queue: ChildNode[]): IterableIterator<ChildNode> {
  queue.reverse();
  let node;
  while ((node = queue.pop())) {
    yield node;
    if (node.nodeType === NodeType.Element) {
      queue.push(...node.childNodes.slice().reverse());
    }
  }
}

const selfClosing = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/** outer html string iterator */
function* outerHtml(node: ChildNode): IterableIterator<string> {
  if (node.nodeType === NodeType.Element) {
    const tag = node.tagName.toLowerCase();
    yield "<";
    yield tag;
    for (const { name, value } of node.attributes) {
      yield " ";
      yield name;
      if (value) {
        yield '="';
        yield value.replace('"', "&quot;");
        yield '"';
      }
    }
    if (selfClosing.has(tag) && !node.childNodes.length) {
      yield "/>";
    } else {
      yield ">";
      for (const child of node.childNodes) {
        yield* outerHtml(child);
      }
      yield "</";
      yield node.tagName.toLowerCase();
      yield ">";
    }
  } else if (node.nodeType === NodeType.Comment) {
    yield "<!--";
    yield node.data;
    yield "-->";
  } else if (node.nodeType === NodeType.Text) {
    yield node.value.replace(/[<&>]/g, (c) => {
      if (c === "<") {
        return "&lt;";
      } else if (c === ">") {
        return "&gt;";
      } else {
        return "&amp;";
      }
    });
  } else {
    yield "<!doctype ";
    yield node.name;
    yield ">";
  }
}

// any is necessary for mixins
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor<T> = new (...args: any[]) => T;

// NOTE once typescript supports class decorator mixing #4881 we should be able
// to make this a bit cleaner
/** parent mixin class */
function ParentMixin<T extends Constructor<HasChildren>>(Base: T) {
  return class Mixed extends Base implements BaseParent {
    get firstChild(): ChildNode | null {
      const [child] = this.childNodes;
      return child ?? null;
    }

    get children(): Element[] {
      const res = [];
      for (const child of this.childNodes) {
        if (child.nodeType === NodeType.Element) {
          res.push(child);
        }
      }
      return res;
    }

    get firstElementChild(): Element | null {
      for (const child of this.childNodes) {
        if (child.nodeType === NodeType.Element) {
          return child;
        }
      }
      return null;
    }

    appendChild(this: ParentNode, child: ChildNode): void {
      if (child.parentNode) {
        const ind = child.parentNode.childNodes.indexOf(child);
        if (ind !== -1) {
          child.parentNode.childNodes.splice(ind, 1);
        }
      }
      child.parentNode = this;
      this.childNodes.push(child);
    }

    replaceChild(
      this: ParentNode,
      replacement: ChildNode,
      child: ChildNode
    ): void {
      replacement.parentNode?.removeChild(replacement);
      replacement.parentNode = this;
      child.parentNode = null;
      const index = this.childNodes.indexOf(child);
      // NOTE this should throw an error, but since we do a hack by attaching a
      // parent, this allows that to still work.
      if (index === -1) {
        this.childNodes.push(replacement);
      } else {
        this.childNodes[index] = replacement;
      }
    }

    removeChild(child: ChildNode): void {
      const index = this.childNodes.indexOf(child);
      child.parentNode = null;
      if (index !== -1) {
        this.childNodes.splice(index, 1);
      }
    }

    getElementsByTagName(tag: string): Element[] {
      const res = [];
      const search = tag.toUpperCase();
      for (const node of dfs(...this.childNodes)) {
        if (
          node.nodeType === NodeType.Element &&
          (tag === "*" || node.tagName === search)
        ) {
          res.push(node);
        }
      }
      return res;
    }
  };
}

/** mixin for child elements */
function ChildMixin<T extends Constructor<HasParent>>(Base: T) {
  return class Mixed extends Base implements BaseChild {
    get ownerDocument(): Document {
      let pointer = this.parentNode;
      while (pointer && pointer.nodeType === NodeType.Element) {
        pointer = pointer.parentNode;
      }
      if (!pointer) {
        throw new Error("top level parent was null");
      } else if (pointer.nodeType === NodeType.DocumentFragment) {
        throw new Error("top level element was a fragment");
      } else {
        return pointer;
      }
    }

    get nextSibling(): ChildNode | null {
      if (!this.parentNode) return null;
      let foundThis = false;
      for (const child of this.parentNode.childNodes) {
        if (foundThis) {
          return child;
          // NOTE due to ChildNode being intentionally restrictive, there's no
          // way to tell typescript that the "final" class will be a child
          // node.
        } else if (child === (this as unknown as ChildNode)) {
          foundThis = true;
        }
      }
      return null;
    }

    get nextElementSibling(): Element | null {
      if (!this.parentNode) return null;
      let foundThis = false;
      for (const child of this.parentNode.childNodes) {
        if (foundThis && child.nodeType === NodeType.Element) {
          return child;
          // NOTE due to ChildNode being intentionally restrictive, there's no
          // way to tell typescript that the "final" class will be a child
          // node.
        } else if (child === (this as unknown as ChildNode)) {
          foundThis = true;
        }
      }
      return null;
    }
  };
}

/** document implementation */
const Doc = ParentMixin(
  class Doc {
    readonly nodeName = "#document";
    readonly nodeType = NodeType.Document;
    mode: DocumentMode = "no-quirks";
    readonly textContent = null;
    childNodes: ChildNode[] = [];

    get documentElement(): Element {
      for (const node of this.childNodes) {
        if (node.nodeType === NodeType.Element && node.tagName === "HTML") {
          return node;
        }
      }
      throw new Error("document didn't have an html element");
    }

    get head(): Element {
      for (const node of this.documentElement.childNodes) {
        if (node.nodeType === NodeType.Element && node.tagName === "HEAD") {
          return node;
        }
      }
      throw new Error("document didn't have a head");
    }

    get body(): Element {
      for (const node of this.documentElement.childNodes) {
        if (node.nodeType === NodeType.Element && node.tagName === "BODY") {
          return node;
        }
      }
      throw new Error("document didn't have a body");
    }

    get title(): string {
      try {
        for (const child of this.head.childNodes) {
          if (
            child.nodeType === NodeType.Element &&
            child.tagName === "TITLE"
          ) {
            return child.textContent;
          }
        }
        return "";
      } catch {
        return "";
      }
    }

    createElement(this: Document, tagName: string): Element {
      const elem = new Elem(tagName, "http://www.w3.org/1999/xhtml");
      // NOTE we set this so that the new node has access to it's root document
      // to continue using document functions
      elem.parentNode = this;
      return elem;
    }
  }
);

/** document fragment implementation */
const Frag = ParentMixin(
  class Frag {
    readonly nodeName = "#document-fragment";
    readonly nodeType = NodeType.DocumentFragment;
    childNodes: ChildNode[] = [];
  }
);

/** element implementation */
const Elem = ParentMixin(
  ChildMixin(
    class Elem {
      readonly nodeType = NodeType.Element;
      parentNode: ParentNode | null = null;
      childNodes: ChildNode[] = [];
      // NOTE ES2020 #private members don't work with mixins
      private _src?: string;
      private _srcset?: string;

      constructor(
        readonly tagName: string,
        public namespaceURI: Namespace,
        public attributes: Attribute[] = []
      ) {}

      get nodeName(): string {
        return this.tagName;
      }

      get localName(): string {
        return this.tagName.toLowerCase();
      }

      getAttribute(attribute: string): string | null {
        for (const { name, value } of this.attributes) {
          if (name === attribute) {
            return value;
          }
        }
        return null;
      }

      setAttribute(name: string, value: string): void {
        for (const attr of this.attributes) {
          if (attr.name === name) {
            attr.value = value;
            return;
          }
        }
        this.attributes.push({ name, value });
      }

      hasAttribute(attribute: string): boolean {
        return this.attributes.some(({ name }) => name === attribute);
      }

      removeAttribute(attribute: string): void {
        const ind = this.attributes.findIndex(({ name }) => name === attribute);
        if (ind !== -1) {
          this.attributes.splice(ind, 1);
        }
      }

      get id(): string {
        return this.getAttribute("id") ?? "";
      }

      set id(val: string) {
        this.setAttribute("id", val);
      }

      get className(): string {
        return this.getAttribute("class") ?? "";
      }

      set className(val: string) {
        this.setAttribute("class", val);
      }

      get src(): string | undefined {
        if (["IMG", "PICTURE", "FIGURE"].indexOf(this.tagName) === -1) {
          return this._src;
        } else {
          return this.getAttribute("src") ?? "";
        }
      }

      set src(val: string | undefined) {
        if (["IMG", "PICTURE", "FIGURE"].indexOf(this.tagName) === -1) {
          this._src = val;
        } else {
          this.setAttribute("src", val ?? "undefined");
        }
      }

      get srcset(): string | undefined {
        if (["IMG", "PICTURE", "FIGURE"].indexOf(this.tagName) === -1) {
          return this._srcset;
        } else {
          return this.getAttribute("srcset") ?? "";
        }
      }

      set srcset(val: string | undefined) {
        if (["IMG", "PICTURE", "FIGURE"].indexOf(this.tagName) === -1) {
          this._srcset = val;
        } else {
          this.setAttribute("srcset", val ?? "undefined");
        }
      }

      get innerHTML(): string {
        const res = [];
        for (const child of this.childNodes) {
          for (const str of outerHtml(child)) {
            res.push(str);
          }
        }
        return res.join("");
      }

      get textContent(): string {
        const vals = [];
        for (const node of dfs(...this.childNodes)) {
          if (node.nodeType === NodeType.Text) {
            vals.push(node.value);
          }
        }
        return vals.join("");
      }
    }
  )
);

const Comm = ChildMixin(
  class Comm {
    readonly nodeName = "#comment";
    readonly nodeType = NodeType.Comment;
    readonly childNodes = [] as const;
    parentNode: ParentNode | null = null;

    constructor(public data: string) {}
  }
);

const Txt = ChildMixin(
  class Txt {
    readonly nodeName = "#text";
    readonly nodeType = NodeType.Text;
    readonly childNodes = [] as const;
    parentNode: ParentNode | null = null;

    constructor(public value: string) {}

    get textContent(): string {
      return this.value;
    }
  }
);

const DocType = ChildMixin(
  class DocType {
    readonly nodeName = "#document-type";
    readonly nodeType = NodeType.DocumentType;
    readonly childNodes = [] as const;
    parentNode: ParentNode | null = null;

    constructor(
      public name: string,
      public publicId: string,
      public systemId: string
    ) {}
  }
);

/** types for the tree adapter map */
export type TreeAdapterTypes = TreeAdapterTypeMap<
  Node,
  ParentNode,
  ChildNode,
  Document,
  DocumentFragment,
  Element,
  CommentNode,
  TextNode,
  Template,
  DocumentType
>;

/** tree adapter that's readability convertible */
export const treeAdapter: TreeAdapter<TreeAdapterTypes> = {
  // ----------------- //
  // Node construction //
  // ----------------- //
  createDocument(): Document {
    return new Doc();
  },

  createDocumentFragment(): DocumentFragment {
    return new Frag();
  },

  createElement(
    tagName: string,
    namespaceURI: html.NS,
    attrs: Attribute[]
  ): Element {
    return new Elem(tagName.toUpperCase(), namespaceURI as Namespace, attrs);
  },

  createCommentNode(data: string): CommentNode {
    return new Comm(data);
  },

  // ------------- //
  // Tree Mutation //
  // ------------- //
  appendChild(parentNode: ParentNode, newNode: ChildNode): void {
    parentNode.childNodes.push(newNode);
    newNode.parentNode = parentNode;
  },

  insertBefore(
    parentNode: ParentNode,
    newNode: ChildNode,
    referenceNode: ChildNode
  ): void {
    const insertionIdx = parentNode.childNodes.indexOf(referenceNode);
    newNode.parentNode = parentNode;
    if (insertionIdx === -1) {
      parentNode.childNodes.push(newNode);
    } else {
      parentNode.childNodes.splice(insertionIdx, 0, newNode);
    }
  },

  setTemplateContent(
    templateElement: Template,
    contentElement: DocumentFragment
  ): void {
    templateElement.content = contentElement;
  },

  getTemplateContent(templateElement: Template): DocumentFragment {
    return templateElement.content;
  },

  setDocumentType(
    document: Document,
    name: string,
    publicId: string,
    systemId: string
  ): void {
    const doctypeNode = document.childNodes.find(
      (node): node is DocumentType => node.nodeType === NodeType.DocumentType
    );

    if (doctypeNode) {
      doctypeNode.name = name;
      doctypeNode.publicId = publicId;
      doctypeNode.systemId = systemId;
    } else {
      const node: DocumentType = new DocType(name, publicId, systemId);
      this.appendChild(document, node);
    }
  },

  setDocumentMode(document: Document, mode: html.DOCUMENT_MODE): void {
    document.mode = mode as DocumentMode;
  },

  getDocumentMode(document: Document): html.DOCUMENT_MODE {
    return document.mode as html.DOCUMENT_MODE;
  },

  detachNode(node: ChildNode): void {
    if (node.parentNode) {
      const idx = node.parentNode.childNodes.indexOf(node);
      node.parentNode.childNodes.splice(idx, 1);
      node.parentNode = null;
    }
  },

  insertText(parentNode: ParentNode, text: string): void {
    if (parentNode.childNodes.length > 0) {
      const prevNode = parentNode.childNodes[parentNode.childNodes.length - 1];

      if (this.isTextNode(prevNode)) {
        prevNode.value += text;
        return;
      }
    }

    this.appendChild(parentNode, new Txt(text));
  },

  insertTextBefore(
    parentNode: ParentNode,
    text: string,
    referenceNode: ChildNode
  ): void {
    const prevNode =
      parentNode.childNodes[parentNode.childNodes.indexOf(referenceNode) - 1];

    if (prevNode && this.isTextNode(prevNode)) {
      prevNode.value += text;
    } else {
      this.insertBefore(parentNode, new Txt(text), referenceNode);
    }
  },

  adoptAttributes(recipient: Element, attrs: Attribute[]): void {
    const recipientAttrsMap = new Set(
      recipient.attributes.map((attr) => attr.name)
    );

    for (const attr of attrs) {
      if (!recipientAttrsMap.has(attr.name)) {
        recipient.attributes.push(attr);
      }
    }
  },

  // --------------- //
  // Tree Traversing //
  // --------------- //
  getFirstChild(node: ParentNode): null | ChildNode {
    return node.childNodes[0] ?? null;
  },

  getChildNodes(node: ParentNode): ChildNode[] {
    return node.childNodes;
  },

  getParentNode(node: ChildNode): null | ParentNode {
    return node.parentNode;
  },

  getAttrList(element: Element): Attribute[] {
    return element.attributes;
  },

  // --------- //
  // Node Data //
  // --------- //
  getTagName(element: Element): string {
    return element.localName;
  },

  getNamespaceURI(element: Element): html.NS {
    return element.namespaceURI as html.NS;
  },

  getTextNodeContent(textNode: TextNode): string {
    return textNode.value;
  },

  getCommentNodeContent(commentNode: CommentNode): string {
    return commentNode.data;
  },

  getDocumentTypeNodeName(doctypeNode: DocumentType): string {
    return doctypeNode.name;
  },

  getDocumentTypeNodePublicId(doctypeNode: DocumentType): string {
    return doctypeNode.publicId;
  },

  getDocumentTypeNodeSystemId(doctypeNode: DocumentType): string {
    return doctypeNode.systemId;
  },

  // ---------- //
  // Node types //
  // ---------- //
  isTextNode(node: Node): node is TextNode {
    return node.nodeType === NodeType.Text;
  },

  isCommentNode(node: Node): node is CommentNode {
    return node.nodeType === NodeType.Comment;
  },

  isDocumentTypeNode(node: Node): node is DocumentType {
    return node.nodeType === NodeType.DocumentType;
  },

  isElementNode(node: Node): node is Element {
    return node.nodeType === NodeType.Element;
  },

  // -------------------- //
  // Source Code Location //
  // -------------------- //
  setNodeSourceCodeLocation(
    node: Node,
    location: ElementLocation | null
  ): void {
    node.sourceCodeLocation = location;
  },

  getNodeSourceCodeLocation(node: Node): ElementLocation | undefined | null {
    return node.sourceCodeLocation;
  },

  updateNodeSourceCodeLocation(node: Node, endLocation: ElementLocation): void {
    node.sourceCodeLocation = { ...node.sourceCodeLocation, ...endLocation };
  },
};
