import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { registerClientTools } from './tools/clients.js';
import { registerChangeTools } from './tools/changes.js';
import { registerGoogleAdsTools } from './tools/google-ads.js';

const server = new Server(
  {
    name: 'google-ads-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const tools = [
  ...registerClientTools(),
  ...registerChangeTools(),
  ...registerGoogleAdsTools(),
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = tools.find((t) => t.name === request.params.name);
  if (!tool) {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }
  return tool.handler(request.params.arguments ?? {});
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('[google-ads-mcp] MCP server running on stdio');
