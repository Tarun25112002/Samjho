import node from "@medhavi/config/eslint/node";

export default [...node, { ignores: ["src/generated/**"] }];
