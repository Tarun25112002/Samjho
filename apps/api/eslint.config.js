import node from "@samjho/config/eslint/node";

export default [...node, { ignores: ["src/generated/**"] }];
