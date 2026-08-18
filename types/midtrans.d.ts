type MidtransPaymentResult =
    Record<string, unknown>;

type MidtransPaymentOptions = {
    onSuccess?: (
        result: MidtransPaymentResult,
    ) => void;

    onPending?: (
        result: MidtransPaymentResult,
    ) => void;

    onError?: (
        result: MidtransPaymentResult,
    ) => void;

    onClose?: () => void;
};

interface Window {
    snap?: {
        pay: (
            token: string,
            options?: MidtransPaymentOptions,
        ) => void;
    };
}