import { createHash } from "node:crypto";

function debug(value: string) {
  console.log(value);
}

export default class TinkoffMerchantAPI {
  /**
   * @param terminalKey Terminal name
   * @param terminalPassword Password for terminal
   */
  constructor(
    public terminalKey: string,
    public terminalPassword: string,
  ) {
    debug(`created for ${this.terminalKey}`);
  }

  /** Url for API */
  static get apiUrl() {
    return "https://securepay.tinkoff.ru/v2/";
  }

  /** Метод инициирует платежную сессию */
  init(params: InitParams): Promise<InitResponse> {
    return this.requestMethod("Init", params);
  }

  /** Метод возвращает статус платежа */
  getState(params: GetStateParams): Promise<GetStateResponse> {
    return this.requestMethod("GetState", params);
  }

  /** Метод возвращает статус заказа */
  checkOrder(params: CheckOrderParams): Promise<CheckOrderResponse> {
    return this.requestMethod("CheckOrder", params);
  }

  /** Подтвердить двухэтапный платёж */
  confirm(params: ConfirmParams): Promise<ConfirmResponse> {
    return this.requestMethod("Confirm", params);
  }

  /**
   * Отменяет платежную сессию. В зависимости от статуса платежа переводит его в следующие состояния:
   *
   * - `NEW` -> `CANCELED`
   * - `AUTHORIZED` -> `PARTIAL_REVERSED` – если отмена не на полную сумму
   * - `AUTHORIZED` -> `REVERSED` - если отмена на полную сумму
   * - `CONFIRMED` -> `PARTIAL_REFUNDED` – если отмена не на полную сумму
   * - `CONFIRMED` -> `REFUNDED` – если отмена на полную сумму
   */
  cancel(params: CancelParams): Promise<CancelResponse> {
    return this.requestMethod("Cancel", params);
  }

  /** Запрос к API Тинькофф */
  private requestMethod(methodName: string, params: any) {
    const methodUrl = `${TinkoffMerchantAPI.apiUrl}${methodName}`;

    const methodParams = { ...params };
    methodParams.TerminalKey = this.terminalKey;
    methodParams.Token = this.getToken(methodParams);

    return fetch(methodUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(methodParams),
    }).then((res) => res.json());
  }

  private getToken(params: object) {
    params = { ...params, Password: this.terminalPassword };

    const str = Object.entries(params)
      .sort(([key1], [key2]) => (key1 > key2 ? 1 : -1))
      .map(([, value]) => value)
      .filter((value) => typeof value == "string" || typeof value == "number")
      .join("");

    return createHash("sha256").update(str).digest("hex");
  }

  /**
   * Check if notification request is valid
   * @param req Express (or express-like) request of notification
   * @param req.ip Request IP
   * @param req.body Params of notification request
   */
  private checkNotificationRequest(req: {
    ip: string;
    body: any;
  }): { success: false; error: string } | { success: true } {
    if (req.body.TerminalKey !== this.terminalKey) {
      return {
        success: false,
        error: `Invalid request TerminalKey: ${req.body.TerminalKey}`,
      };
    }

    const tokenParams = { ...req.body };
    delete tokenParams.Token;
    if (req.body.Token !== this.getToken(tokenParams)) {
      return {
        success: false,
        error: `Invalid request Token`,
      };
    }

    return { success: true };
  }
}

export type Taxation =
  | "osn"
  | "usn_income"
  | "usn_income_outcome"
  | "envd"
  | "esn"
  | "patent";

export type ItemTax = "none" | "vat0" | "vat10" | "vat20" | "vat110" | "vat120";

export type PaymentMethod =
  | "full_prepayment"
  | "prepayment"
  | "advance"
  | "full_payment"
  | "partial_payment"
  | "credit"
  | "credit_payment";

export type PaymentObject =
  | "commodity"
  | "excise"
  | "job"
  | "service"
  | "gambling_bet"
  | "gambling_prize"
  | "lottery"
  | "lottery_prize"
  | "intellectual_activity"
  | "payment"
  | "agent_commission"
  | "composite"
  | "another";

export type FfdVersion = "1.2" | "1.05";

export type Receipt = {
  "Items": Item[];
  "Taxation": Taxation;
  "FfdVersion"?: FfdVersion;
  "Payments"?: Payments;
} & ({ "Email": string } | { "Phone": string });

export interface InitParams {
  // "TerminalKey": string;
  "Amount": number;
  "OrderId": string;
  "Description"?: string;
  // "Token": string;

  /**
   * Идентификатор клиента в системе Мерчанта.
   *
   * Обязателен, если передан атрибут Recurrent.
   * Если был передан в запросе, в нотификации будет указан CustomerKey и его CardId. См. метод GetCardList.
   * Необходим для сохранения карт на платежной форме (платежи в один клик).
   * Не является обязательным при реккурентных платежах через СБП.
   */
  "CustomerKey"?: string;
  "Recurrent"?: string; //TODO
  "PayType"?: "O" | "T";
  "Language"?: "ru" | "en";
  /**
   * URL на веб-сайте Мерчанта, куда будет отправлен POST запрос о статусе выполнения вызываемых методов (настраивается в Личном кабинете):
   *
   * - Если параметр передан – используется его значение.
   * - Если нет – значение в настройках терминала.
   */
  "NotificationURL"?: string;
  /**
   * URL на веб-сайте Мерчанта, куда будет переведен клиент в случае успешной оплаты (настраивается в Личном кабинете):
   *
   * - Если параметр передан – используется его значение.
   * - Если нет – значение в настройках терминала.
   */
  "SuccessURL"?: string;
  /**
   * URL на веб-сайте Мерчанта, куда будет переведен клиент в случае неуспешной оплаты (настраивается в Личном кабинете):
   *
   * - Если параметр передан – используется его значение.
   * - Если нет – значение в настройках терминала.
   */
  "FailURL"?: string;
  /**
   * Cрок жизни ссылки или динамического QR-кода СБП (если выбран данный способ оплаты). Если текущая дата превышает дату, переданную в данном параметре, ссылка для оплаты или возможность платежа по QR-коду становятся недоступными и платёж выполнить нельзя.
   * - Максимальное значение: 90 дней от текущей даты.
   * - Минимальное значение: 1 минута от текущей даты.
   * - Формат даты: `YYYY-MM-DDTHH24:MI:SS+GMT`
   * - Пример даты: `2016-08-31T12:28:00+03:00`
   * - Если не передан, принимает значение 24 часа для платежа и 30 дней для счета
   *
   * В случае, если параметр RedirectDueDate не был передан, проверяется настроечный параметр платежного терминала REDIRECT_TIMEOUT, который может содержать значение срока жизни ссылки в часах. Если его значение больше нуля, то оно будет установлено в качестве срока жизни ссылки или динамического QR-кода. Иначе, устанавливается значение «по умолчанию» - 1440 мин.(1 сутки)
   */
  "RedirectDueDate"?: string;
  // TODO: можно усложнить
  "DATA"?: Record<string, string>;

  /** JSON-объект с данными чека. Обязателен, если подключена онлайн-касса. */
  // TODO: сделать опциональным, если не подключена онлайн-касса
  "Receipt"?: Receipt;
}

export interface InitResponse {
  "TerminalKey": string;
  "Amount": number;
  "OrderId": string;
  "Success": boolean;
  "Status": string;
  "PaymentId": string;
  "ErrorCode": number;
  /** Ссылка на платежную форму (параметр возвращается только для Мерчантов без PCI DSS) */
  "PaymentURL"?: string;
  /** Краткое описание ошибки */
  "Message"?: string;
  /** Подробное описание ошибки */
  "Details"?: string;
}

export interface GetStateParams {
  "TerminalKey": string;
  "PaymentId": string;
  "Token": string;
  /** IP-адрес клиента */
  "IP"?: string;
}

export interface GetStateResponse {
  "TerminalKey": string;
  "Amount": string;
  "OrderId": string;
  "Success": boolean;
  "Status": "NEW" | "CANCELED" | "PREAUTHORIZING" | "FORMSHOWED";
  "PaymentId": number;
  "ErrorCode": number;
  /** Краткое описание ошибки */
  "Message"?: string;
  /** Подробное описание ошибки */
  "Details"?: string;
  /** Детали для платежей в рассрочку */
  "Params"?: object[];
}

export interface ConfirmParams {
  "TerminalKey": string;
  "PaymentId": string;
  "Token": string;
  "IP"?: string;
  "Amount"?: string;
  "Receipt"?: Receipt;
  "Shops": Shop[];
  /**
   * Способ платежа.
   *
   * - При проведении платежа в «Рассрочку» необходимо передавать значение `TCB`
   * - При проведении платежа «Долями» необходимо передавать значение `BNPL`
   */
  "Route": PaymentRoute;
  /**
   * Источник платежа.
   *
   * - При проведении платежа в «Рассрочку» необходимо передавать значение `installment`
   * - При проведении платежа «Долями» необходимо передавать значение `BNPL`
   */
  "Source": PaymentSource;
}

export type PaymentRoute = "TCB" | "BNPL";
export type PaymentSource = "installment" | "BNPL";

export interface ConfirmResponse {
  "TerminalKey": string;
  "OrderId": string;
  "Success": boolean;
  "Status":
    | "NEW"
    | "AUTHORIZING"
    | "AUTHORIZED"
    | "AUTH_FAIL"
    | "CANCELED"
    | "CHECKING"
    | "CHECKED"
    | "COMPLETING"
    | "COMPLETED"
    | "CONFIRMING"
    | "CONFIRMED"
    | "DEADLINE_EXPIRED"
    | "FORMSHOWED"
    | "PARTIAL_REFUNDED"
    | "PREAUTHORIZING"
    | "PROCESSING"
    | "3DS_CHECKING"
    | "3DS_CHECKED"
    | "REVERSING"
    | "REVERSED"
    | "REFUNDING"
    | "REFUNDED"
    | "REJECTED"
    | "UNKNOWN";

  "PaymentId": string;
  "ErrorCode": string;

  "Message"?: string;
  "Details"?: string;
  "Params": Items_Params;
}

export interface CheckOrderParams {
  "TerminalKey": string;
  "OrderId": string;
  "Token": string;
}

export interface CheckOrderResponse {
  "TerminalKey": string;
  "OrderId": string;
  "Success": boolean;
  "ErrorCode": string;
  "Message"?: string;
  "Details"?: string;
  "Payments": PaymentsCheckOrder;
}

export interface CancelParams {
  "TerminalKey": string;
  "PaymentId": string;
  "Token": string;
  "IP"?: string;
  "Amount"?: number;
  "Receipt"?: Receipt;
  "Shops"?: Shop[];
  /** Код банка в классификации СБП, в который необходимо выполнить возврат */
  "QrMemberId"?: string;
  "Route"?: PaymentRoute;
  "Source"?: PaymentSource;
  /**
   * Идентификатор операции на стороне мерчанта
   *
   * - Если поле не передано или пустое (""), то запрос будет обработан без проверки ранее созданных возвратов
   * - Если поле заполнено, то перед проведением возврата проверяется запрос на отмену с таким ExternalRequestId
   *    - Если такой запрос уже есть, то в ответе вернется текущее состояние платежной операции
   *    - Если такого запроса нет, то произойдет отмена платежа
   */
  "ExternalrequestId"?: string;
}

export interface CancelResponse {
  "TerminalKey": string;
  "OrderId": string;
  "Success": boolean;
  "Status": string;
  "OriginalAmount": number;
  "NewAmount": number;
  "PaymentId": string;
  "ErrorCode": string;

  "Message"?: string;
  "Details"?: string;
  "ExternalrequestId"?: string;
}

// TODO
export interface PaymentsCheckOrder {}

export interface Shop {
  "ShopCode": string;
  "Amount": string;
  "Name": string;
  "Fee"?: string;
}

// TODO: смутило, что в документации структура объекта Items определена два раза. Разобраться.

export interface Item {
  "Name": string;
  "Price": number;
  "Quantity": number;
  "Amount": number;
  /** Признак способа расчёта. Если значение не передано, по умолчанию в онлайн-кассу передается признак способа расчёта "full_payment" */
  "PaymentMethod"?: PaymentMethod;
  /** Признак предмета расчёта.Если значение не передано, по умолчанию в онлайн-кассу отправляется признак предмета расчёта "commodity" */
  "PaymentObject"?: PaymentObject;
  "Tax": ItemTax;
  "Ean13"?: string;
  "ShopCode"?: string;
  "AgentData"?: AgentData;
  "SupplierInfo"?: AgentData;
}

export interface Payments {
  "Cash"?: number;
  "Electronic": number;
  "AdvancePayment"?: number;
  "Credit"?: number;
  "Provision"?: number;
}

export type AgentSign =
  | "bank_paying_agent"
  | "bank_paying_subagent"
  | "paying_agent"
  | "paying_subagent"
  | "attorney"
  | "commission_agent"
  | "another";

export type OperationName = "bank_paying_agent" | "bank_paying_subagent";

export interface AgentData {
  "AgentSign"?: AgentSign;
  "OperationName"?: OperationName;
  // TODO: обязательно ли это поле?
  "Phones"?: string[];
  // TODO: обязательно ли это поле?
  "RecieverPhones"?: string[];
  // TODO: обязательно ли это поле?
  "TransferPhones"?: string[];
  // TODO: обязательно ли это поле?
  "OperatorName"?: string;
  // TODO: обязательно ли это поле?
  "OperatorAddress"?: string;
  // TODO: обязательно ли это поле?
  "OperatorInn"?: string;
}

export interface SupplierInfo {
  // TODO: обязательно ли это поле?
  "Phones"?: string[];
  // TODO: обязательно ли это поле?
  "Name"?: string[];
  // TODO: обязательно ли это поле?
  "Inn"?: string[];
}

export interface ClientInfo {}

export interface OperatingСheckProps {}

export interface SectoralCheckProps {}

export interface AddUserProp {}

export interface Items_Params {}
