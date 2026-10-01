import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
    ...nextCoreWebVitals,
    {
        ignores: ["app/generated/**"],
    },
];

export default eslintConfig;
