const { Anthropic } = require('@anthropic-ai/sdk');
const db = require('./db');
require('dotenv').config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'dummy_key',
});

const analyzeSymptoms = async (appointmentId, symptoms) => {
  try {
    await db.query("UPDATE appointments SET pre_visit_status = 'pending' WHERE id = $1", [appointmentId]);

    const msg = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 300,
      system: "You are a medical assistant. Output only a JSON with keys: urgency (Low/Medium/High), chiefComplaint, questions (array of 3 strings).",
      messages: [
        { "role": "user", "content": `Symptoms: ${symptoms}` }
      ]
    });

    const resultText = msg.content[0].text;
    
    await db.query(
      "UPDATE appointments SET pre_visit_summary = $1, pre_visit_status = 'completed' WHERE id = $2",
      [resultText, appointmentId]
    );
  } catch (error) {
    console.error('LLM Failure:', error);
    // Fallback handled here
    await db.query("UPDATE appointments SET pre_visit_status = 'failed' WHERE id = $1", [appointmentId]);
    // Would enqueue a retry job here for exponential backoff if this wasn't just a prototype
  }
};

module.exports = { analyzeSymptoms };
