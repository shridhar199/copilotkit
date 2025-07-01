import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Action } from "@copilotkit/shared";
// import { CopilotRuntimeActionContext } from "@copilotkit/backend";
import { v4 as uuidv4 } from "uuid";
import {
  CopilotRuntime,
  LangChainAdapter,
} from '@copilotkit/runtime';
// import { IncomingMessage } from 'http';
// interface CopilotKitActionContextWithHeaders {
//   // This might be the structure when using the `headers` prop on the frontend CopilotKit component
//   headers: {
//     authorization?: string; // Or your specific header name if you used a different one
//     // ... other headers passed from the frontend
//   };
//   // Other properties CopilotKit might pass in context (e.g., userId, runId, etc.)
//   [key: string]: any; // Fallback for other potential properties
// }

const createRuleAction: Action<any> = {
  name: "createRule",
  description: "Create a new business rule in the backend",
  parameters: [
    { name: "name", type: "string" },
    { name: "conditionFact", type: "string" },
    { name: "conditionValue", type: "string" },
    { name: "conditionOperator", type: "string" },
    { name: "eventType", type: "string" },
    { name: "eventValue", type: "string" },
  ],
  handler: async ({
    name,
    conditionFact,
    conditionValue,
    conditionOperator,
    eventType,
    eventValue,
  }) => {
    // console.log("context", context)
    const rule_set_id = uuidv4();
    const operatorMap: Record<string, string> = {
      ">": "greaterThan",
      ">=": "greaterThanInclusive",
      "<": "lessThan",
      "<=": "lessThanInclusive",
      "==": "equal",
      "=": "equal",
      "!=": "notEqual",
      "in": "in",
      "notIn": "notIn"
    };

    const normalizedOperator = operatorMap[conditionOperator] || conditionOperator;

    if (!Object.values(operatorMap).includes(normalizedOperator) && !Object.keys(operatorMap).includes(conditionOperator)) {
      throw new Error(`Invalid or unsupported operator: ${conditionOperator}`);
    }

    const rule = {
      name,
      active: true,
      conditions: [
        {
          id: uuidv4(),
          rule_set_id,
          key: "any",
          fact: conditionFact,
          value: conditionValue,
          operator: normalizedOperator,
        },
      ],
      events: [
        {
          id: uuidv4(),
          rule_set_id,
          type: eventType,
          value: eventValue,
        },
      ],
    };
    console.log("rule------>", rule)
    const response = await fetch(`${process.env.SERVER_RULE_ENGINE_URL}/rules`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(rule),
    });

    if (!response.ok) {
      throw new Error("Failed to create rule");
    }
    // triggerRefresh()
    // useRulesStore.getState().triggerRefresh();
    return { success: true, message: `Rule "${name}" created successfully.` };
  },
};

const updateRuleAction: Action<any> = {
  name: "updateRule",
  description: "Update a rule's name, conditions, or events. Always fetch the latest rule data first to get correct IDs.",
  parameters: [
    {
      name: "ruleName",
      type: "string",
      description: "Current name of the rule to update.",
    },
    {
      name: "updates",
      type: "object",
      description: "Fields to update.",
      attributes: [
        {
          name: "newName",
          type: "string",
          description: "New name for the rule (optional).",
          required: false,
        },
        {
          name: "newActive",
          type: "string",
          description: "New active for the rule (optional).",
          required: false,
        },
        {
          name: "conditionUpdates",
          type: "object[]",
          description: "Conditions to update (provide fact/value/operator).",
          required: false,
          attributes: [
            { name: "fact", type: "string" },
            { name: "value", type: "string" },
            { name: "operator", type: "string" },
          ],
        },
        {
          name: "eventUpdates",
          type: "object[]",
          description: "Events to update (provide type/value).",
          required: false,
          attributes: [
            { name: "type", type: "string" },
            { name: "value", type: "string" },
          ],
        },
      ], // Explicit type assertion
    },
  ],
  handler: async ({ ruleName, updates }) => {
    // 1. Fetch the rule by name to get current IDs
    // console.log("headeers",header)
    // console.log("context")
    const fetchResponse = await fetch(
      `${process.env.SERVER_RULE_ENGINE_URL}/rules/name/${encodeURIComponent(ruleName)}`
    );
    if (!fetchResponse.ok) {
      throw new Error(`Rule "${ruleName}" not found.`);
    }
    const currentRule = await fetchResponse.json();

    // 2. Prepare condition updates (map user input to existing IDs)
    const ruleSetId = currentRule.data.id
    const active = currentRule.data.active
    const updatedActive = JSON.parse(updates.newActive)
    const updatedConditions = updates.conditionUpdates?.map((update:any) => {
      const existingCondition = currentRule.data.conditions.find(
        (c: any) => c.ruleSetId === ruleSetId
      );
      if (!existingCondition) {
        throw new Error(`Condition not associated with this rule.`);
      }
      return {
        id: existingCondition.id,
        ruleSetId: existingCondition.ruleSetId,
        fact: update.fact || existingCondition.fact,
        value: update.value || existingCondition.value,
        operator: update.operator || existingCondition.operator,
      };
    });

    // 3. Prepare event updates (map user input to existing IDs)
    const updatedEvents = updates.eventUpdates?.map((update:any) => {
      const existingEvent = currentRule.data.events.find(
        (e: any) => e.ruleSetId === ruleSetId
      );
      if (!existingEvent) {
        throw new Error(`Event not associated with this rule`);
      }
      return {
        id: existingEvent.id,
        ruleSetId: existingEvent.ruleSetId,
        type: update.type || existingEvent.type,
        value: update.value || existingEvent.value,
      };
    });

    // 4. Send the update
    const updateResponse = await fetch(
      `${process.env.SERVER_RULE_ENGINE_URL}/rules/update/${encodeURIComponent(ruleName)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: updates.newName || ruleName,
          active: updates.newActive ? updatedActive : active, // Keep current name if not provided
          conditions: updatedConditions || currentRule.conditions,
          events: updatedEvents || currentRule.events,
        }),
      }
    );

    if (!updateResponse.ok) {
      throw new Error(`Failed to update rule: ${await updateResponse.text()}`);
    }
    // useRulesStore.getState().triggerRefresh();
    console.log("Inside update action state updated")
    return {
      success: true,
      message: `Rule "${ruleName}" updated successfully.`,
      updatedRule: await updateResponse.json(),
    };
  },
};

const deleteRuleAction: Action<any> = {
  name: "deleteRule",
  description: "Delete a business rule by its name.",
  parameters: [
    {
      name: "ruleName",
      type: "string",
      description: "The exact name of the rule to delete."
    }
  ],
  handler: async ({ ruleName }) => {
        // const req = context.req;

    // --- CONSOLE.LOG THE HEADERS HERE ---
    // console.log("Incoming Request Headers:", context);
    // console.log("Authorization Header:", req.headers.authorization)
    // console.log("headers",context)
    const response = await fetch(
      `${process.env.SERVER_RULE_ENGINE_URL}/rules/delete/${encodeURIComponent(ruleName)}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete rule: ${await response.text()}`);
    }

    return { 
      success: true,
      message: `Rule "${ruleName}" was deleted successfully.`,
    };
  },
};

// const actions: Action<any>[] = [createRuleAction, updateRuleAction, deleteRuleAction];


// Initialize the Google Generative AI model
const model = new ChatGoogleGenerativeAI({
  model: "gemini-1.5-flash",
  temperature: 0,
  apiKey: process.env.GOOGLE_API_KEY || "AIzaSyD4yWWGEzvnM_TDSKS3LLMeTElp-2vJFww",
});

// Create CopilotRuntime instance
export const runtime = new CopilotRuntime({
    actions:[createRuleAction, updateRuleAction, deleteRuleAction]
});


export const serviceAdapter = new LangChainAdapter({
  chainFn: async ({ messages, tools, threadId }) => {
    console.log("POST messages: ", messages);
    console.log("POST tools: ", Object.keys(tools));
    console.log("POST tools: ", tools.map(tool => {
      return {
        name: tool.lc_kwargs.name,
        func: JSON.stringify(tool.lc_kwargs.func)
      };
    }));
    console.log("POST threadId: ", threadId);
    
    const modelWithTools = model.bindTools(tools);
    return modelWithTools.stream(messages, { 
      tools, 
      metadata: { conversation_id: threadId } 
    });
  },
});