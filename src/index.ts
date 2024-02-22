import { sha256 } from "./sha256.ts";

function debug(value: string) {
  console.log(value);
}

export default class TinkoffMerchantAPI {
  get terminalKey() {
    return this.config.terminalKey;
  }

  get terminalPassword() {
    return this.config.terminalPassword;
  }

  private get debug() {
    return this.config.debug ?? false;
  }

  constructor(
    private config: {
      terminalKey: string;
      terminalPassword: string;
      debug?: boolean;
    },
  ) {
    if (this.debug) {
      const message = `created TinkoffMerchantApi for terminal with key: ${this.terminalKey}`;
      debug(message);
    }
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
  private async requestMethod(method: ApiMethod, params: any) {
    const methodUrl = `${TinkoffMerchantAPI.apiUrl}${method}`;

    const methodParams = { ...params };
    methodParams.TerminalKey = this.terminalKey;
    methodParams.Token = await this.getToken(methodParams);

    if (this.debug) {
      debug(method + ":");
      debug(JSON.stringify(methodParams, null, 2));
    }

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

    return sha256(str);
  }
}

export type ApiMethod =
  | "Init"
  | "GetState"
  | "CheckOrder"
  | "Confirm"
  | "Cancel";

export interface InitParams {
  // "TerminalKey": string;
  // "Token": string;
  "Amount": number;
  "OrderId": string;
  "Description"?: string;

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
  "Status": PaymentStatus;
  "PaymentId": string; // Здесь точно string, в других местах - не точно
  "ErrorCode": number;
  /** Ссылка на платежную форму (параметр возвращается только для Мерчантов без PCI DSS) */
  "PaymentURL"?: string;
  /** Краткое описание ошибки */
  "Message"?: string;
  /** Подробное описание ошибки */
  "Details"?: string;
}

export interface GetStateParams {
  // "Token": string;
  // "TerminalKey": string;
  "PaymentId": string;
  /** IP-адрес клиента */
  "IP"?: string;
}

export interface GetStateResponse {
  "TerminalKey": string;
  "Amount": number;
  "OrderId": string;
  "Success": boolean;
  "Status": PaymentStatus;
  "PaymentId": string;
  "ErrorCode": number;
  /** Краткое описание ошибки */
  "Message"?: string;
  /** Подробное описание ошибки */
  "Details"?: string;
  /** Детали для платежей в рассрочку */
  "Params"?: object[];
}

export interface ConfirmParams {
  // "TerminalKey": string;
  // "Token": string;
  "PaymentId": string;
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

export interface ConfirmResponse {
  "TerminalKey": string;
  "OrderId": string;
  "Success": boolean;
  "Status": PaymentStatus;

  "PaymentId": string;
  "ErrorCode": string;

  "Message"?: string;
  "Details"?: string;
  "Params": Items_Params;
}

export interface CheckOrderParams {
  // "TerminalKey": string;
  // "Token": string;
  "OrderId": string;
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
  // "TerminalKey": string;
  // "Token": string;
  "PaymentId": string;
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
  "Status": PaymentStatus;
  "OriginalAmount": number;
  "NewAmount": number;
  "PaymentId": string;
  "ErrorCode": string;

  "Message"?: string;
  "Details"?: string;
  "ExternalrequestId"?: string;
}

export interface PaymentsCheckOrder {}

export type Taxation =
  | "osn"
  | "usn_income"
  | "usn_income_outcome"
  | "envd"
  | "esn"
  | "patent";

export type Tax = "none" | "vat0" | "vat10" | "vat20" | "vat110" | "vat120";

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

export type Receipt = Receipt_FFD_105 | Receipt_FFD_12;

export interface Receipt_FFD_105 {
  "FfdVersion": "1.05";
}

export interface Receipt_FFD_12 {
  "FfdVersion": "1.2";
  "Taxation": Taxation;
  // <-- I'm here
  "Items": Item_FFD_12[];
  "Payments"?: Payments;
  // email or phone
  "Email"?: string;
  "Phone"?: string;

  "ClientInfo"?: ClientInfo;
  "Customer"?: string;
  "CustomerInn"?: string;
  "OperatingCheckProps"?: OperatingСheckProps;
  "SectoralCheckProps"?: SectoralCheckProps;
  "AddUserProp"?: AddUserProp;
  "AdditionalCheckProps"?: object;
}

export interface Item_FFD_12 {
  "Name": string;
  /** Цена в копейках за 1 шт */
  "Price": number;
  /**
   * Количество/вес:
   * - целая часть не более 5 знаков;
   * - дробная часть не более 3 знаков для Атол, не более 2 знаков для CloudPayments
   *
   * Значение «1», если передан объект markCode // TODO
   */
  "Quantity": number;
  /** Сумма в копейках (Quantity * Price) */
  "Amount": number;
  /** Признак способа расчёта */
  "PaymentMethod": PaymentMethod;
  /** Признак предмета расчёта */
  "PaymentObject": PaymentObject;
  /** Дополнительный реквизит предмета расчета */
  "UserData"?: string;
  /** Сумма акциза в рублях с учетом копеек, включенная в стоимость предмета расчета */
  "Excise"?: number;
  /** Цифровой код страны происхождения товара в соответствии с Общероссийским классификатором стран мира (3 цифры) */
  "CountryCode"?: string;
  /** Номер таможенной декларации (32 цифры максимум) */
  "DeclarationNumber"?: string;
  /** Единицы измерения. Передовать в соответствии с ОК 015-94 (МК 002-97) */
  "MeasurementUnit": MeasurementUnit;
  /** Режим обработки кода маркировки */
  "MarkProcessingMode"?: string;
  "MarkCode"?: MarkCode;
  "MarkQuantity"?: MarkQuantity;

  "SectoralItemProps"?: SelectoralItemProps[];
  "Tax": Tax;
  "AgentData"?: AgentData;
  "SupplierInfo"?: SupplierInfo;
}

export interface Payments {
  /** Вид оплаты "Наличные". Сумма к оплате в копейках не более 14 знаков */
  "Cash"?: number;
  /** Вид оплаты "Безналичный" */
  "Electronic"?: number;
  /** Вид оплаты "Предварительная оплата (Аванс)" */
  "AdvancePayment"?: number;
  /** Вид оплаты "Постоплата (Кредит)" */
  "Credit"?: number;
  /** Вид оплаты "Иная форма оплаты" */
  "Provision"?: number;
}

export interface MarkCode {
  /** Тип штрих кода */
  "MarkCodeType": MarkCodeType;
  "value": string;
}

export interface MarkQuantity {
  "numerator": number;
  "denominator": number;
}

export interface SelectoralItemProps {
  "Number": string;
  "Date": string;
  "Value": string;
  "FederalId": string;
}

export type OperationName = "bank_paying_agent" | "bank_paying_subagent";

export type PaymentRoute = "TCB" | "BNPL";
export type PaymentSource = "installment" | "BNPL";

export interface Shop {
  "ShopCode": string;
  "Amount": string;
  "Name"?: string;
  "Fee"?: string;
}

export interface AgentData {
  "AgentSign"?: AgentSign;
  "OperationName"?: OperationName;
  "Phones"?: string[];
  "ReceiverPhones"?: string[];
  "TransferPhones"?: string[];
  "OperatorName"?: string;
  "OperatorAddress"?: string;
  "OperatorInn"?: string;
}

export interface SupplierInfo {
  /** Телефон поставщика, в формате +{Ц} (1-19 символов в каждой строке массива) */
  "Phones"?: string[];
  /** Наименование поставщика */
  "Name"?: string;
  /** ИНН поставщика, в формате ЦЦЦЦЦЦЦЦЦЦ (10-12 символов) */
  "Inn"?: string;
}

export interface ClientInfo {
  "Birthdate"?: string;
  "Citizenship"?: string;
  "DocumentCode"?: string;
  "DocumentData"?: string;
  "Address"?: string;
}

export interface OperatingСheckProps {
  "Name": string;
  "Value": string;
  "Timestamp": string;
}

export interface SectoralCheckProps {
  "FederalId": string;
  "Date": string;
  "Number": string;
  "Value": string;
}

export interface AddUserProp {
  "Name": string;
  "Value": string;
}

export interface Items_Params {}

export type PaymentStatus =
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
  | "FORM_SHOWED"
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

export type AgentSign =
  | "bank_paying_agent"
  | "bank_paying_subagent"
  | "paying_agent"
  | "paying_subagent"
  | "attorney"
  | "commission_agent"
  | "another";

export type MarkCodeType =
  | "UNKNOWN"
  | "EAN8"
  | "EAN13"
  | "ITF14"
  | "GS10"
  | "GS1M"
  | "SHORT"
  | "FUR"
  | "EGAIS20"
  | "EGAIS30"
  | "RAWCODE";

/**
 * Данные из таблицы:
 * https://www.consultant.ru/document/cons_doc_LAW_362322/0060b1f1924347c03afbc57a8d4af63888f81c6c/
 * */
export const MEASUREMENT_UNIT = {
  "gram": 10,
  "kilogram": 11,
  "ton": 12,
  "centimeter": 20,
  "decimeter": 21,
  "meter": 22,
  "square_centimeter": 30,
  "square_decimeter": 31,
  "square_meter": 32,
  "millimeter": 40,
  "liter": 41,
  "cubic_meter": 42,
  "kilowatt_per_hour": 50,
  "gigacalorie": 51,
  "day": 70,
  "hour": 71,
  "minute": 72,
  "second": 73,
  "kilobyte": 80,
  "megabyte": 81,
  "gigabyte": 82,
  "terabyte": 83,
  "other": 255,
} as const;

export type MeasurementUnit =
  (typeof MEASUREMENT_UNIT)[keyof typeof MEASUREMENT_UNIT];
