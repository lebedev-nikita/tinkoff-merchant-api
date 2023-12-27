# Tinkoff Merchant API

Node.js implementation of [Tinkoff Merchant API v2](https://www.tinkoff.ru/kassa/dev/payments/).

## Installation

```
npm i tinkoff-merchant-api-ts
```

## How to use

```js
import TinkoffMerchantAPI from "tinkoff-merchant-api-ts";

const tinkoffApi = new TinkoffMerchantAPI(
  process.env.TERMINAL_KEY,
  process.env.TERMINAL_PASSWORD,
);

// Pass params for API method except TerminalKey and Token (they will be added automatically)
const result = await bankApi.init({
  Amount: "200000",
  OrderId: "123",
  DATA: {
    Email: "user@ya.ru",
    Phone: "+71234567890",
  },
  Receipt: {
    Email: "user@ya.ru",
    Phone: "+71234567890",
    Taxation: "osn",
    Items: [
      {
        Name: "Наименование товара 1",
        Price: 100.0,
        Quantity: 1.0,
        Amount: 100.0,
        Tax: "vat10",
        Ean13: "0123456789",
      },
      {
        Name: "Наименование товара 2",
        Price: 200.0,
        Quantity: 2.0,
        Amount: 400.0,
        Tax: "vat18",
      },
    ],
  },
});
```

You can use another implemented [methods](index.js).

Also you can check if notification request is valid

```js
// Use Express req object or your own express-like object with ip and request params:
// const req = {
//     ip: '91.194.226.1',
//     body: {
//         "Amount":"100000",
//         "CardId":"751596",
//         "ErrorCode":"0",
//         "OrderId":"1",
//         "Pan":"430000******0777",
//         "PaymentId":"1671111",
//         "RebillId":"",
//         "Status":"AUTHORIZED",
//         "Success":"true",
//         "TerminalKey":"1234567890123",
//         "Token":"239ea18cfd5dfcc72423778c0634bcf90987af8600fc835b8f7d7657cc95c69b"
//     }
// };
const isValidNotificationRequest =
  bankApi.checkNotificationRequest(req).success;
console.log(isValidNotificationRequest);
```
