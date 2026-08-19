type SnapTransactionInput = {
    orderId: string;
    amount: number;
    customer: {
        name: string;
        email: string;
        phone?: string | null;
    };
};

type SnapTransactionResult = {
    token: string;
    redirect_url: string;
};

export async function createSnapTransaction({
    orderId,
    amount,
    customer,
}: SnapTransactionInput): Promise<SnapTransactionResult> {
    const serverKey = process.env.MIDTRANS_SERVER_KEY;

    if (!serverKey) {
        throw new Error("MIDTRANS_SERVER_KEY belum dikonfigurasi");
    }

    const isProduction =
        process.env.MIDTRANS_IS_PRODUCTION === "true";

    const baseUrl = isProduction
        ? "https://app.midtrans.com"
        : "https://app.sandbox.midtrans.com";

    const authorization = Buffer.from(
        `${serverKey}:`,
    ).toString("base64");

    const response = await fetch(
        `${baseUrl}/snap/v1/transactions`,
        {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: `Basic ${authorization}`,
            },
            body: JSON.stringify({
                transaction_details: {
                    order_id: orderId,
                    gross_amount: amount,
                },
                customer_details: {
                    first_name: customer.name,
                    email: customer.email,
                    phone: customer.phone || undefined,
                },
                credit_card: {
                    secure: true,
                },
            }),
            cache: "no-store",
        },
    );

    const result = await response.json();

    if (!response.ok) {
        console.error("Midtrans error:", result);
        throw new Error("Gagal membuat transaksi Midtrans");
    }

    return result as SnapTransactionResult;
}


export type MidtransTransactionStatus = {
    order_id: string;
    transaction_id: string;
    transaction_status: string;
    status_code: string;
    gross_amount: string;
    payment_type?: string;
    fraud_status?: string;
    signature_key?: string;
    // Present when transaction_status is "refund" or "partial_refund" —
    // cumulative amount refunded so far, per Midtrans transaction-status
    // reference.
    refund_amount?: string;
};

export async function getMidtransTransactionStatus(
    orderId: string,
): Promise<MidtransTransactionStatus> {
    const serverKey = process.env.MIDTRANS_SERVER_KEY;

    if (!serverKey) {
        throw new Error(
            "MIDTRANS_SERVER_KEY belum dikonfigurasi",
        );
    }

    const isProduction =
        process.env.MIDTRANS_IS_PRODUCTION === "true";

    const baseUrl = isProduction
        ? "https://api.midtrans.com"
        : "https://api.sandbox.midtrans.com";

    const authorization = Buffer.from(
        `${serverKey}:`,
    ).toString("base64");

    const response = await fetch(
        `${baseUrl}/v2/${encodeURIComponent(orderId)}/status`,
        {
            method: "GET",
            headers: {
                Accept: "application/json",
                Authorization: `Basic ${authorization}`,
            },
            cache: "no-store",
        },
    );

    const result = await response.json();

    if (!response.ok) {
        console.error(
            "Midtrans status error:",
            result,
        );

        throw new Error(
            "Gagal mengambil status pembayaran",
        );
    }

    return result as MidtransTransactionStatus;
}