/**
 * Tools Registry — semua tool definitions + implementations
 * Menggunakan JS tools asli via dynamic require() (DRY - tidak duplikasi logika)
 * Override khusus untuk tools yang butuh Vercel-compatible implementation
 */

/* eslint-disable */

// TS-native Vercel overrides
import { sendStudioPhotoTool } from './sendStudioPhotoTool';
import { triggerBosMatTool } from './triggerBosMatTool';

// JS tools — require() dijalankan saat runtime (Node.js server), bukan saat bundling
// Path di-resolve via webpack alias @monorepo/tools yang dikonfigurasi di next.config.mjs
function loadJsTools() {
  const { getServiceDetailsTool } = require('../../../../legacy-backend/src/ai/tools/getServiceDetailsTool.js');
  const { getStudioInfoTool } = require('../../../../legacy-backend/src/ai/tools/getStudioInfoTool.js');
  const { checkBookingAvailabilityTool } = require('../../../../legacy-backend/src/ai/tools/checkBookingAvailabilityTool.js');
  const { createBookingTool } = require('../../../../legacy-backend/src/ai/tools/createBookingTool.js');
  const { updateBookingTool } = require('../../../../legacy-backend/src/ai/tools/updateBookingTool.js');
  const { getCurrentDateTimeTool } = require('../../../../legacy-backend/src/ai/tools/getCurrentDateTimeTool.js');
  const { calculateHomeServiceFeeTool } = require('../../../../legacy-backend/src/ai/tools/calculateHomeServiceFeeTool.js');
  const { notifyVisitIntentTool } = require('../../../../legacy-backend/src/ai/tools/notifyVisitIntentTool.js');
  const { sendMessageTool } = require('../../../../legacy-backend/src/ai/tools/sendMessageTool.js');
  const { crmManagementTool } = require('../../../../legacy-backend/src/ai/tools/crmManagementTool.js');
  const { addTransactionTool, getTransactionHistoryTool, calculateFinancesTool } = require('../../../../legacy-backend/src/ai/tools/financeManagementTool.js');
  const { updateSystemPromptTool } = require('../../../../legacy-backend/src/ai/tools/updateSystemPromptTool.js');
  const { getSystemPromptTool } = require('../../../../legacy-backend/src/ai/tools/getSystemPromptTool.js');
  const { updatePromoOfTheMonthTool } = require('../../../../legacy-backend/src/ai/tools/updatePromoOfTheMonthTool.js');
  const { readDirectMessagesTool } = require('../../../../legacy-backend/src/ai/tools/readDirectMessagesTool.js');

  return {
    getServiceDetailsTool,
    getStudioInfoTool,
    checkBookingAvailabilityTool,
    createBookingTool,
    updateBookingTool,
    getCurrentDateTimeTool,
    calculateHomeServiceFeeTool,
    notifyVisitIntentTool,
    sendMessageTool,
    crmManagementTool,
    addTransactionTool,
    getTransactionHistoryTool,
    calculateFinancesTool,
    updateSystemPromptTool,
    getSystemPromptTool,
    updatePromoOfTheMonthTool,
    readDirectMessagesTool,
  };
}

/* eslint-enable */

export interface ToolDefinition {
  type: string;
  function: {
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
  };
}

export interface Tool {
  toolDefinition: ToolDefinition;
  implementation: (args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Get all tools — Admin mode (full set)
 */
export function getAllTools(): Tool[] {
  const js = loadJsTools();
  return [
    js.getServiceDetailsTool,
    js.getStudioInfoTool,
    js.checkBookingAvailabilityTool,
    js.createBookingTool,
    js.updateBookingTool,
    js.getCurrentDateTimeTool,
    js.calculateHomeServiceFeeTool,
    triggerBosMatTool,
    sendStudioPhotoTool,
    js.notifyVisitIntentTool,
    js.sendMessageTool,
    js.crmManagementTool,
    js.addTransactionTool,
    js.getTransactionHistoryTool,
    js.calculateFinancesTool,
    js.updateSystemPromptTool,
    js.getSystemPromptTool,
    js.updatePromoOfTheMonthTool,
    js.readDirectMessagesTool,
  ];
}

/**
 * Get customer-facing tools — subset (fewer tools = fewer tokens)
 */
export function getCustomerTools(): Tool[] {
  const js = loadJsTools();
  return [
    js.getServiceDetailsTool,
    js.getStudioInfoTool,
    js.checkBookingAvailabilityTool,
    js.createBookingTool,
    js.updateBookingTool,
    js.calculateHomeServiceFeeTool,
    triggerBosMatTool,
    sendStudioPhotoTool,
    js.notifyVisitIntentTool,
  ];
}

/**
 * Build LangChain-compatible tool specs from tool definitions
 * Strips senderNumber/senderName from parameters (injected by engine, not model)
 */
export function prepareToolSpecs(tools: Tool[]) {
  return tools.map((tool) => {
    const functionDef = tool.toolDefinition?.function;
    if (!functionDef) return tool.toolDefinition;

    const parameters: Record<string, unknown> = functionDef.parameters
      ? JSON.parse(JSON.stringify(functionDef.parameters))
      : {};

    const props = parameters.properties as Record<string, unknown> | undefined;
    if (props) {
      delete props.senderNumber;
      delete props.senderName;
      delete props.sender_number;
      delete props.sender_name;
    }

    const required = parameters.required as string[] | undefined;
    if (required) {
      parameters.required = required.filter(
        (p) =>
          p !== 'senderNumber' &&
          p !== 'senderName' &&
          p !== 'sender_number' &&
          p !== 'sender_name'
      );
    }

    return {
      type: 'function',
      function: {
        name: functionDef.name,
        description: functionDef.description,
        parameters: Object.keys(parameters).length > 0 ? parameters : undefined,
      },
    };
  });
}

/**
 * Build a lookup map: toolName → implementation
 */
export function buildAvailableTools(
  tools: Tool[],
  overrides: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {}
): Record<string, (args: Record<string, unknown>) => Promise<unknown>> {
  const map: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {};

  for (const tool of tools) {
    const name = tool.toolDefinition?.function?.name;
    if (name) {
      map[name] = overrides[name] ?? tool.implementation;
    }
  }

  return { ...map, ...overrides };
}
