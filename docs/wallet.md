# Wallet

Every member and recruiter has a wallet. They top it up by M-Pesa and pay application fees from the balance. Until a Safaricom till or paybill is registered, top-ups are confirmed by hand; the M-Pesa prompt (STK) code in `src/server/payments.ts` is unchanged and can later be used to top up wallets automatically.

## How a top-up works

1. An administrator sets the M-Pesa number and the name M-Pesa shows for it on **Admin → Wallet top-ups** (stored in `PlatformSettings.topUpPhone` / `topUpName`). Until then, members see "Top-ups open soon".
2. The member opens **Wallet → Top up**, follows the steps (Send Money to that number), and enters the amount, the M-Pesa code and the time they paid.
3. A `TopUpRequest` is saved as `PENDING`. The member gets a "We've received your top-up" email and administrators get a notification (emailed by the notification worker).
4. An administrator checks the M-Pesa statement and either:
   - **Confirms**, entering the amount actually received (it defaults to the claimed amount). The wallet is credited, a `WalletEntry` is written, and the member gets a "… added to your KBO wallet" email.
   - **Rejects** with a reason. Nothing is credited; the member gets an email with the reason.

Processed top-ups never change: a second confirm or reject is refused (`ALREADY_PROCESSED`).

Rules: each M-Pesa code can be claimed once (unique, 10 letters and numbers), amounts are KES 10 to 150,000, the payment time can't be in the future or more than 30 days old, and a member can have at most 3 top-ups waiting.

## Paying for an application

On a draft application for an open job, **Pay from wallet** pays the fee and submits the application in one step (`payFromWallet` in `src/server/wallet.ts`). It runs the same checks as an M-Pesa payment (profile complete, screened CV attached, job open, account active, current version) and records the same paid `PaymentOrder`, with a `WALLET-…` receipt, so recruiters, receipts and dashboards treat it like any other paid application. If the balance is short, the box offers a top-up for the difference.

## Data

- `User.walletBalanceMinor`: the balance in cents. It is only changed inside a transaction that locks the user row, together with a `WalletEntry`.
- `WalletEntry`: the ledger (`TOP_UP` credits, `APPLICATION_FEE` debits) with the balance after each change. Entries are never edited or deleted.
- `TopUpRequest`: the member's claim, the amount credited, who reviewed it and when.
- Database checks keep balances from going negative and require positive amounts and well-formed codes.
