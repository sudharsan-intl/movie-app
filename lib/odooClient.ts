import axios, { AxiosInstance } from "axios";

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
type DomainOperator = "|" | "&" | "!";
type DomainClause = DomainCondition | DomainOperator;

type SearchReadOptions = {
  model: string;
  domain?: DomainClause[];
  fields?: string[];
  limit?: number;
  order?: string;
  context?: Record<string, unknown>;
};

type OdooCredentials = {
  serverUrl: string;
  database: string;
  username: string;
  password: string;
};

export type OdooUserProfile = {
  id: number;
  name: string;
  email?: string;
  partnerId?: number;
  companyId?: number;
};

export type OdooSession = OdooCredentials & {
  uid: number;
  user: OdooUserProfile;
};

const DEFAULT_CONTEXT = { lang: "en_US" as const };
const WRITE_CONTEXT = { lang: false as const };
const KNOWN_ODOO_SUFFIXES = new Set(["odoo.com", "odoo.sh", "odoo.in", "odoo-online.com"]);
const RESERVED_PATH_SEGMENTS = new Set(["web", "saas", "xmlrpc", "jsonrpc"]);
const DEFAULT_TIMEOUT = 15000;

type ExecuteKwSession = Pick<OdooSession, "database" | "uid" | "password">;

let activeSession: OdooSession | null = null;
let client: AxiosInstance | null = null;
let rpcCounter = 0;

const buildContext = (context?: Record<string, unknown>) => ({
  ...DEFAULT_CONTEXT,
  ...context,
});

const cleanObject = (input?: Record<string, unknown>) => {
  if (!input) return {};
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== null)
  );
};

const nextRpcId = () => {
  rpcCounter += 1;
  return rpcCounter;
};

const extractErrorMessage = (error?: JsonRpcError) => {
  if (!error) return "Unknown Odoo error";
  const parts = [error.message, error.data?.message, error.data?.debug];
  return parts.filter(Boolean).join(" | ") || "Unknown Odoo error";
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const buildClient = (baseUrl: string) =>
  axios.create({
    baseURL: `${trimTrailingSlash(baseUrl)}/jsonrpc`,
    headers: {
      "Content-Type": "application/json",
    },
    timeout: DEFAULT_TIMEOUT,
  });

const ensureSession = (): OdooSession => {
  if (!activeSession) {
    throw new Error("Not authenticated with Odoo. Please sign in again.");
  }

  return activeSession;
};

const ensureClientAndSession = () => {
  const session = ensureSession();
  if (!client) {
    client = buildClient(session.serverUrl);
  }

  return { client, session };
};

const executeKwWith = async <T>(
  httpClient: AxiosInstance,
  session: ExecuteKwSession,
  { model, method, args = [], kwargs = {} }: ExecuteKwOptions
): Promise<T> => {
  const response = await httpClient.post<JsonRpcResponse<T>>("", {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [session.database, session.uid, session.password, model, method, args, cleanObject(kwargs)],
    },
    id: nextRpcId(),
  });

  if (response.data.error) {
    throw new Error(extractErrorMessage(response.data.error));
  }

  if (typeof response.data.result === "undefined") {
    throw new Error("Unexpected empty response from Odoo");
  }

  return response.data.result;
};

const executeKw = async <T>(options: ExecuteKwOptions): Promise<T> => {
  const { client: httpClient, session } = ensureClientAndSession();
  return executeKwWith(httpClient, session, options);
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

const ensureProtocol = (value: string) => (/^https?:\/\//i.test(value) ? value : `https://${value}`);

type ParsedInputUrl = {
  protocol: "http" | "https";
  host: string;
  path: string;
  query: string;
  hash: string;
};

const parseInputUrl = (value: string): ParsedInputUrl | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = ensureProtocol(trimmed);
  const match = normalized.match(/^(https?):\/\/([^\/?#]+)(\/[^?#]*)?(\?[^#]*)?(#.*)?$/i);
  if (!match) {
    return null;
  }

  const protocol = match[1].toLowerCase() as "http" | "https";
  const host = match[2];
  const path = match[3] ?? "";
  const query = match[4] ?? "";
  const hash = match[5] ?? "";
  return { protocol, host, path, query, hash };
};

const normalizePath = (path: string) => {
  if (!path) return "";

  const trimmedPath = path.trim();
  if (!trimmedPath) return "";

  const normalized = trimmedPath.replace(/\/+/g, "/");
  const withoutTrailing = normalized.replace(/\/+$/, "");
  const segments = withoutTrailing.split("/").filter(Boolean);
  return segments.length > 0 ? `/${segments.join("/")}` : "";
};

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const parseParams = (segment: string): Record<string, string> => {
  if (!segment) return {};
  const clean = segment.replace(/^[?#]/, "");
  if (!clean) return {};

  return clean.split(/[&;]/).reduce<Record<string, string>>((acc, pair) => {
    if (!pair) return acc;
    const [rawKey, rawValue = ""] = pair.split("=");
    const key = safeDecode(rawKey.trim());
    if (!key) return acc;
    const value = safeDecode(rawValue.replace(/\+/g, " "));
    acc[key] = value;
    return acc;
  }, {});
};

const normalizeServerUrl = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Server address is required.");
  }

  const parsed = parseInputUrl(trimmed);
  if (!parsed) {
    throw new Error("Invalid server address.");
  }

  const path = normalizePath(parsed.path);
  return `${parsed.protocol}://${parsed.host}${path}`;
};

const extractDatabaseFromUrl = (raw: string): string | undefined => {
  const parsed = parseInputUrl(raw);
  if (!parsed) {
    return undefined;
  }

  const queryParams = parseParams(parsed.query);
  const fromQuery = queryParams.db?.trim();
  if (fromQuery) {
    return fromQuery;
  }

  const hashParams = parseParams(parsed.hash);
  const fromHash = hashParams.db?.trim();
  if (fromHash) {
    return fromHash;
  }

  const hashValue = parsed.hash.replace(/^#/, "").trim();
  if (!fromHash && hashValue && !hashValue.includes("=") && !hashValue.includes("&")) {
    return hashValue;
  }

  const pathSegments = normalizePath(parsed.path).split("/").filter(Boolean);
  if (pathSegments.length === 1) {
    const candidate = pathSegments[0];
    if (!RESERVED_PATH_SEGMENTS.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  const hostSegments = parsed.host.split(".").filter(Boolean);
  if (hostSegments.length >= 2) {
    const suffix = hostSegments.slice(-2).join(".");
    if (KNOWN_ODOO_SUFFIXES.has(suffix) || hostSegments.length > 2) {
      const candidate = hostSegments[0];
      if (candidate && candidate.toLowerCase() !== "www") {
        return candidate;
      }
    }
  }

  return undefined;
};
const discoverDatabase = async (httpClient: AxiosInstance): Promise<string | undefined> => {
  try {
    const response = await httpClient.post<JsonRpcResponse<string[]>>("", {
      jsonrpc: "2.0",
      method: "call",
      params: {
        service: "db",
        method: "list",
        args: [],
      },
      id: nextRpcId(),
    });

    if (response.data.error) {
      return undefined;
    }

    const databases = response.data.result;
    if (Array.isArray(databases) && databases.length === 1 && typeof databases[0] === "string") {
      return databases[0];
    }
  } catch {
    return undefined;
  }

  return undefined;
};

const authenticateWithClient = async (
  httpClient: AxiosInstance,
  { database, username, password }: { database: string; username: string; password: string }
): Promise<number> => {
  const db = database.trim();
  const login = username.trim();

  if (!db) {
    throw new Error("Database is required.");
  }

  if (!login) {
    throw new Error("Username or email is required.");
  }

  if (!password) {
    throw new Error("Password is required.");
  }

  const response = await httpClient.post<JsonRpcResponse<number>>("", {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "common",
      method: "authenticate",
      args: [db, login, password, {}],
    },
    id: nextRpcId(),
  });

  if (response.data.error) {
    throw new Error(extractErrorMessage(response.data.error));
  }

  const uid = response.data.result;
  if (typeof uid !== "number" || !Number.isInteger(uid)) {
    throw new Error("Invalid login response from Odoo");
  }

  return uid;
};

export type SignInParams = {
  serverUrl: string;
  username: string;
  password: string;
  database?: string;
};

export type SignInResult = {
  session: OdooSession;
  user: OdooUserProfile;
};

export const signInToOdoo = async ({
  serverUrl,
  username,
  password,
  database,
}: SignInParams): Promise<SignInResult> => {
  const normalizedServerUrl = normalizeServerUrl(serverUrl);
  const httpClient = buildClient(normalizedServerUrl);
  const login = username.trim();

  const resolvedDatabase = (database && database.trim())
    || extractDatabaseFromUrl(serverUrl)
    || (await discoverDatabase(httpClient));

  if (!resolvedDatabase) {
    throw new Error("Could not determine the Odoo database. Please provide it in the advanced settings.");
  }

  const uid = await authenticateWithClient(httpClient, {
    database: resolvedDatabase,
    username: login,
    password,
  });

  const userRecords = await executeKwWith<Record<string, unknown>[]>(
    httpClient,
    { database: resolvedDatabase, uid, password },
    {
      model: "res.users",
      method: "read",
      args: [[uid]],
      kwargs: {
        fields: ["name", "email", "login", "partner_id", "company_id"],
        context: buildContext(),
      },
    }
  );

  const rawUser = Array.isArray(userRecords) && userRecords.length > 0 ? userRecords[0] : {};
  const partnerIdRaw = Array.isArray((rawUser as Record<string, unknown>).partner_id)
    ? (rawUser as Record<string, unknown>).partner_id?.[0]
    : undefined;
  const companyIdRaw = Array.isArray((rawUser as Record<string, unknown>).company_id)
    ? (rawUser as Record<string, unknown>).company_id?.[0]
    : undefined;

  const profile: OdooUserProfile = {
    id: uid,
    name:
      typeof (rawUser as Record<string, unknown>).name === "string" && ((rawUser as Record<string, unknown>).name as string).trim().length > 0
        ? ((rawUser as Record<string, unknown>).name as string).trim()
        : login,
    email:
      typeof (rawUser as Record<string, unknown>).email === "string" && ((rawUser as Record<string, unknown>).email as string).trim().length > 0
        ? ((rawUser as Record<string, unknown>).email as string).trim()
        : typeof (rawUser as Record<string, unknown>).login === "string"
          ? ((rawUser as Record<string, unknown>).login as string).trim()
          : undefined,
    partnerId: Number.isInteger(partnerIdRaw) ? Number(partnerIdRaw) : undefined,
    companyId: Number.isInteger(companyIdRaw) ? Number(companyIdRaw) : undefined,
  };

  const sessionData: OdooSession = {
    serverUrl: normalizedServerUrl,
    database: resolvedDatabase,
    username: login,
    password,
    uid,
    user: profile,
  };

  activeSession = sessionData;
  client = httpClient;

  return { session: sessionData, user: profile };
};

export const signOutFromOdoo = () => {
  activeSession = null;
  client = null;
};

export const getActiveSession = () => activeSession;

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

type ProductTemplateUpdatableField =
  | "name"
  | "list_price"
  | "description_sale"
  | "sale_ok"
  | "active"
  | "default_code"
  | "image_1920";

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
        args: [[["product_tmpl_id", "=", id]]],
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


export type OdooMenuEntry = {
  id: number;
  name: string;
  web_icon_data?: string | false;
  action?: string | false;
  sequence?: number;
  parent_id?: [number, string] | false;
};

const MENU_FIELDS = ["name", "web_icon_data", "action", "sequence", "parent_id"] as const;

const normalizeMenuRecords = (records: unknown): OdooMenuEntry[] => {
  if (!Array.isArray(records)) return [];
  return records.filter((entry): entry is OdooMenuEntry => {
    if (!entry || typeof entry !== "object") return false;
    return typeof (entry as { id?: unknown }).id === "number" && typeof (entry as { name?: unknown }).name === "string";
  });
};

export const fetchRootMenus = async (): Promise<OdooMenuEntry[]> => {
  const domain: DomainClause[] = [
    ["parent_id", "=", false],
    ["action", "!=", false],
  ];

  const records = await executeSearchRead<OdooMenuEntry[]>({
    model: "ir.ui.menu",
    domain,
    fields: [...MENU_FIELDS],
    order: "sequence asc",
  });

  return normalizeMenuRecords(records);
};

export const fetchChildMenus = async (parentId: number): Promise<OdooMenuEntry[]> => {
  if (!Number.isInteger(parentId)) {
    return [];
  }

  const domain: DomainClause[] = [
    ["parent_id", "=", parentId],
    ["action", "!=", false],
  ];

  const records = await executeSearchRead<OdooMenuEntry[]>({
    model: "ir.ui.menu",
    domain,
    fields: [...MENU_FIELDS],
    order: "sequence asc",
  });

  return normalizeMenuRecords(records);
};
