import axios from "axios";

const ODOO_URL = "https://happycolours.odoo.com";
const DB = "happycolours";
const LOGIN = "happycolours@uniflame.org";
const API_KEY = "0e4bba0a6bc0c7ec21f6d9752885137d76dec53a";

const client = axios.create({
  baseURL: `${ODOO_URL}/jsonrpc`,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

type JsonRpcErrorData = {
  name?: string;
  debug?: string;
  message?: string;
};

type JsonRpcError = {
  code: number;
  message: string;
  data?: JsonRpcErrorData;
};

type JsonRpcResponse<T> = {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: JsonRpcError;
};

type ExecuteKwOptions = {
  model: string;
  method: string;
  args?: unknown[];
  kwargs?: Record<string, unknown>;
};

type DomainCondition = [string, string, unknown];
type DomainOperator = '|' | '&' | '!';
type DomainClause = DomainCondition | DomainOperator;

type SearchReadOptions = {
  model: string;
  domain?: DomainClause[];
  fields?: string[];
  limit?: number;
  order?: string;
  context?: Record<string, unknown>;
};

let cachedUid: number | null = null;
let rpcCounter = 0;
const DEFAULT_CONTEXT = { lang: "en_US" as const };
const WRITE_CONTEXT = { lang: false as const };


const buildContext = (context?: Record<string, unknown>) => ({
  ...DEFAULT_CONTEXT,
  ...context,
});


const nextRpcId = () => {
  rpcCounter += 1;
  return rpcCounter;
};

const extractErrorMessage = (error?: JsonRpcError) => {
  if (!error) return "Unknown Odoo error";
  const parts = [error.message, error.data?.message, error.data?.debug];
  return parts.filter(Boolean).join(" | ") || "Unknown Odoo error";
};

const authenticate = async (): Promise<number> => {
  if (cachedUid) return cachedUid;

  const response = await client.post<
    JsonRpcResponse<number>
  >("", {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "common",
      method: "authenticate",
      args: [DB, LOGIN, API_KEY, {}],
    },
    id: nextRpcId(),
  });

  if (response.data.error) {
    throw new Error(extractErrorMessage(response.data.error));
  }

  const uid = response.data.result;
  if (typeof uid !== "number") {
    throw new Error("Failed to authenticate with Odoo");
  }

  cachedUid = uid;
  return uid;
};

const cleanObject = (input?: Record<string, unknown>) => {
  if (!input) return {};
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== null)
  );
};

const executeKw = async <T>({ model, method, args = [], kwargs = {} }: ExecuteKwOptions): Promise<T> => {
  const uid = await authenticate();

  const response = await client.post<
    JsonRpcResponse<T>
  >("", {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [DB, uid, API_KEY, model, method, args, cleanObject(kwargs)],
    },
    id: nextRpcId(),
  });

  if (response.data.error) {
    cachedUid = null;
    throw new Error(extractErrorMessage(response.data.error));
  }

  if (typeof response.data.result === "undefined") {
    throw new Error("Unexpected empty response from Odoo");
  }

  return response.data.result;
};

const executeSearchRead = async <T>({
  model,
  domain = [],
  fields,
  limit,
  order,
  context,
}: SearchReadOptions): Promise<T> => {
    return executeKw<T>({
    model,
    method: "search_read",
    args: [domain],
    kwargs: cleanObject({ fields, limit, order, context: buildContext(context) }),
  });
};

export type OdooMovieRecord = {
  id: number;
  name: string;
  [key: string]: unknown;
};

const MOVIE_MODEL = "movie.movie";
const MOVIE_FIELDS = ["name", "genre", "release_date", "rating"];

export const searchMovies = async (query: string): Promise<OdooMovieRecord[]> => {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const records = await executeSearchRead<OdooMovieRecord[]>({
    model: MOVIE_MODEL,
    domain: [["name", "ilike", trimmed]],
    fields: MOVIE_FIELDS,
    limit: 20,
    order: "release_date desc",
  });

  return Array.isArray(records) ? records : [];
};

export type OdooProductTemplate = {
  id: number;
  name: string;
  list_price: number;
  currency_id?: [number, string];
  description_sale?: string | false;
  image_1920?: string | false;
  image_512?: string | false;
  image_256?: string | false;
  sale_ok?: boolean;
  active?: boolean;
  default_code?: string | false;
};

const PRODUCT_MODEL = "product.template";
const PRODUCT_FIELDS = [
  "name",
  "list_price",
  "currency_id",
  "description_sale",
  "image_1920",
  "image_512",
  "image_256",
  "sale_ok",
  "active",
  "default_code",
];

type FetchProductTemplatesOptions = {
  limit?: number;
  search?: string;
  categoryId?: number;
  includeInactive?: boolean;
  order?: string;
};

export const fetchProductTemplates = async (
  options: FetchProductTemplatesOptions = {}
): Promise<OdooProductTemplate[]> => {
  const {
    limit,
    search,
    categoryId,
    includeInactive = false,
    order = "write_date desc",
  } = options;

  const effectiveLimit = typeof limit === "number" ? limit : 40;

  const domain: DomainClause[] = [["sale_ok", "=", true]];

  if (!includeInactive) {
    domain.push(["active", "=", true]);
  }

  if (typeof categoryId === "number") {
    domain.push(["categ_id", "child_of", categoryId]);
  }

  if (search && search.trim().length > 0) {
    const term = search.trim();
    domain.push("|");
    domain.push(["name", "ilike", term]);
    domain.push(["default_code", "ilike", term]);
  }

  const records = await executeSearchRead<OdooProductTemplate[]>({
    model: PRODUCT_MODEL,
    domain,
    fields: PRODUCT_FIELDS,
    limit: effectiveLimit,
    order,
  });

  return Array.isArray(records) ? records : [];
};

type ProductTemplateUpdatableField = "name" | "list_price" | "description_sale" | "sale_ok" | "active" | "default_code" | "image_1920";

export type UpdateProductTemplateInput = Partial<Pick<OdooProductTemplate, ProductTemplateUpdatableField>>;

const sanitizeProductUpdate = (input: UpdateProductTemplateInput) => {
  const payload: Record<string, unknown> = {};

  if (typeof input.name === "string") {
    const trimmed = input.name.trim();
    if (!trimmed) {
      throw new Error("Product name cannot be empty");
    }
    payload.name = trimmed;
  }

  if (typeof input.list_price !== "undefined") {
    const numericPrice = Number(input.list_price);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      throw new Error("Price must be a non-negative number");
    }
    payload.list_price = numericPrice;
  }

  if (typeof input.description_sale !== "undefined") {
    if (typeof input.description_sale === "string") {
      const trimmed = input.description_sale.trim();
      payload.description_sale = trimmed.length === 0 ? false : trimmed;
    } else if (input.description_sale === false) {
      payload.description_sale = false;
    }
  }

  if (typeof input.default_code !== "undefined") {
    if (typeof input.default_code === "string") {
      const trimmed = input.default_code.trim();
      payload.default_code = trimmed.length === 0 ? false : trimmed;
    } else if (input.default_code === false) {
      payload.default_code = false;
    }
  }

  if (typeof input.image_1920 !== "undefined") {
    if (typeof input.image_1920 === "string") {
      const trimmed = input.image_1920.trim();
      payload.image_1920 = trimmed.length > 0 ? trimmed : false;
    } else if (input.image_1920 === false) {
      payload.image_1920 = false;
    }
  }

  if (typeof input.sale_ok === "boolean") {
    payload.sale_ok = input.sale_ok;
  }

  if (typeof input.active === "boolean") {
    payload.active = input.active;
  }

  return payload;
};

export const getProductTemplate = async (
  id: number,
  fields: string[] = PRODUCT_FIELDS
): Promise<OdooProductTemplate | null> => {
  if (!Number.isInteger(id)) {
    throw new Error("Invalid product id");
  }

  const records = await executeKw<OdooProductTemplate[]>({
    model: PRODUCT_MODEL,
    method: "read",
    args: [[id]],
    kwargs: { fields, context: buildContext() },
  });

  if (!Array.isArray(records) || records.length === 0) {
    return null;
  }

  return records[0];
};

export const updateProductTemplate = async (
  id: number,
  values: UpdateProductTemplateInput
): Promise<boolean> => {
  if (!Number.isInteger(id)) {
    throw new Error("Invalid product id");
  }

  const payload = sanitizeProductUpdate(values);
  if (Object.keys(payload).length === 0) {
    return false;
  }

  const result = await executeKw<boolean>({
    model: PRODUCT_MODEL,
    method: "write",
    args: [[id], payload],
    kwargs: { context: buildContext() },
  });

  if (!result) {
    return false;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "name")) {
    try {
      await executeKw<boolean>({
        model: PRODUCT_MODEL,
        method: "write",
        args: [[id], { name: payload.name }],
        kwargs: { context: buildContext(WRITE_CONTEXT) },
      });
    } catch (err) {
      console.warn("Failed to update base product name", err);
    }

    try {
      const variantIds = await executeKw<number[]>({
        model: "product.product",
        method: "search",
        args: [[
          ["product_tmpl_id", "=", id],
        ]],
      });

      if (Array.isArray(variantIds) && variantIds.length > 0) {
        await executeKw<boolean>({
          model: "product.product",
          method: "write",
          args: [variantIds, { name: payload.name }],
          kwargs: { context: buildContext(WRITE_CONTEXT) },
        });
      }
    } catch (err) {
      console.warn("Failed to update variant names", err);
    }
  }

  return true;
};

export const deleteProductTemplates = async (ids: number | number[]): Promise<boolean> => {
  const idList = Array.isArray(ids) ? ids : [ids];
  const uniqueIds = Array.from(new Set(idList.map(Number))).filter(
    (value): value is number => Number.isInteger(value) && value > 0
  );

  if (uniqueIds.length === 0) {
    throw new Error("Invalid product id");
  }

  const result = await executeKw<boolean>({
    model: PRODUCT_MODEL,
    method: "unlink",
    args: [uniqueIds],
    kwargs: { context: buildContext(WRITE_CONTEXT) },
  });

  return !!result;
};


export const searchProductTemplates = async (
  query: string,
  options: Omit<FetchProductTemplatesOptions, "search"> = {}
): Promise<OdooProductTemplate[]> => {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { limit = 25, ...rest } = options;
  return fetchProductTemplates({ ...rest, search: trimmed, limit });
};



























