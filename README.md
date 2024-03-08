# Tinkoff Merchant API

## How to use

```ts
import TinkoffMerchantAPI from "tinkoff-merchant-api";

const tinkoffApi = new TinkoffMerchantAPI({
  terminalKey: Deno.env.get("TERMINAL_KEY")!,
  terminalPassword: Deno.env.get("TERMINAL_PASSWORD")!,
});

// Pass params for API method except TerminalKey and Token (they will be added automatically)
const result = await tinkoffApi.init({
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
