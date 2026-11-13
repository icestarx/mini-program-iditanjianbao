CREATE TABLE "users" (
    "user_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "wx_open_id" VARCHAR(128) NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);
CREATE UNIQUE INDEX "users_wx_open_id_key" ON "users"("wx_open_id");

CREATE TABLE "user_wallet" (
    "user_id" UUID NOT NULL,
    "cash_balance" INTEGER NOT NULL DEFAULT 500 CHECK ("cash_balance" >= 0),
    "voucher_balance" INTEGER NOT NULL DEFAULT 0 CHECK ("voucher_balance" >= 0),
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "user_wallet_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "user_wallet_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "wallet_ledger" (
    "ledger_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "currency" VARCHAR(2) NOT NULL CHECK ("currency" IN ('C', 'G')),
    "balance_before" INTEGER NOT NULL,
    "amount_delta" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "reason" VARCHAR(64) NOT NULL,
    "business_id" VARCHAR(64) NOT NULL,
    "request_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wallet_ledger_pkey" PRIMARY KEY ("ledger_id"),
    CONSTRAINT "wallet_ledger_request_id_key" UNIQUE ("request_id"),
    CONSTRAINT "wallet_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "wallet_ledger_user_id_created_at_idx" ON "wallet_ledger"("user_id", "created_at");

CREATE TABLE "npc" (
    "npc_id" VARCHAR(8) NOT NULL,
    "npc_type" VARCHAR(24) NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "profile" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT "npc_pkey" PRIMARY KEY ("npc_id")
);
CREATE TABLE "stall" (
    "stall_id" VARCHAR(8) NOT NULL,
    "npc_id" VARCHAR(8) NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "unlock_level" INTEGER NOT NULL DEFAULT 1,
    "slot_count" SMALLINT NOT NULL DEFAULT 10 CHECK ("slot_count" = 10),
    "quote_factor" DECIMAL(4,2) NOT NULL DEFAULT 1,
    "min_deal_ratio" DECIMAL(4,2) NOT NULL DEFAULT 0.5,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT "stall_pkey" PRIMARY KEY ("stall_id"),
    CONSTRAINT "stall_npc_id_fkey" FOREIGN KEY ("npc_id") REFERENCES "npc"("npc_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "product_item" (
    "product_id" VARCHAR(8) NOT NULL,
    "config_version" VARCHAR(16) NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "product_type" VARCHAR(24) NOT NULL,
    "authenticity" VARCHAR(16) NOT NULL,
    "value_base_c" INTEGER NOT NULL,
    "perceived_anchor_c" INTEGER NOT NULL,
    "unlock_level" INTEGER NOT NULL DEFAULT 1,
    "max_purchases_per_user" INTEGER NOT NULL CHECK ("max_purchases_per_user" > 0),
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT "product_item_pkey" PRIMARY KEY ("product_id")
);
CREATE TABLE "stall_product" (
    "stall_product_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "stall_id" VARCHAR(8) NOT NULL,
    "slot_no" SMALLINT NOT NULL CHECK ("slot_no" BETWEEN 1 AND 10),
    "product_id" VARCHAR(8) NOT NULL,
    "seller_ask_c" INTEGER NOT NULL CHECK ("seller_ask_c" > 0),
    CONSTRAINT "stall_product_pkey" PRIMARY KEY ("stall_product_id"),
    CONSTRAINT "stall_product_stall_id_slot_no_key" UNIQUE ("stall_id", "slot_no"),
    CONSTRAINT "stall_product_stall_id_fkey" FOREIGN KEY ("stall_id") REFERENCES "stall"("stall_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "stall_product_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product_item"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "user_product_purchase_count" (
    "user_id" UUID NOT NULL,
    "product_id" VARCHAR(8) NOT NULL,
    "purchased_count" INTEGER NOT NULL DEFAULT 0 CHECK ("purchased_count" >= 0),
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "user_product_purchase_count_pkey" PRIMARY KEY ("user_id", "product_id"),
    CONSTRAINT "user_product_purchase_count_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "user_product_purchase_count_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product_item"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "user_product" (
    "user_product_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "stall_product_id" UUID NOT NULL,
    "product_id" VARCHAR(8) NOT NULL,
    "product_config_version" VARCHAR(16) NOT NULL,
    "purchase_price_c" INTEGER NOT NULL,
    "appraisal_status" VARCHAR(16) NOT NULL DEFAULT 'UNAPPRAISED',
    "ownership_status" VARCHAR(16) NOT NULL DEFAULT 'OWNED',
    "purchased_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_product_pkey" PRIMARY KEY ("user_product_id"),
    CONSTRAINT "user_product_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "user_product_stall_product_id_fkey" FOREIGN KEY ("stall_product_id") REFERENCES "stall_product"("stall_product_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "user_product_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product_item"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "user_product_user_id_ownership_status_idx" ON "user_product"("user_id", "ownership_status");
CREATE TABLE "product_purchase" (
    "purchase_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "stall_product_id" UUID NOT NULL,
    "product_id" VARCHAR(8) NOT NULL,
    "user_product_id" UUID NOT NULL,
    "price_c" INTEGER NOT NULL,
    "purchased_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_purchase_pkey" PRIMARY KEY ("purchase_id"),
    CONSTRAINT "product_purchase_request_id_key" UNIQUE ("request_id"),
    CONSTRAINT "product_purchase_user_product_id_key" UNIQUE ("user_product_id"),
    CONSTRAINT "product_purchase_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "product_purchase_stall_product_id_fkey" FOREIGN KEY ("stall_product_id") REFERENCES "stall_product"("stall_product_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "product_purchase_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product_item"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
