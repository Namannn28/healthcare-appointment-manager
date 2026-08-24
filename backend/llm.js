const { Anthropic } = require('@anthropic-ai/sdk');
const db = require('./db');
require('dotenv').config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'dummy_key',
});

// Pre-visit Summary
const analyzeSymptoms = async (appointmentId, symptoms) => {
  try {
    await db.query("UPDATE appointments SET pre_visit_status = 'pending' WHERE id = $1", [appointmentId]);

    const msg = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 300,
      system: "You are a medical assistant. Output only a JSON with keys: urgency (Low/Medium/High), chiefComplaint, questions (array of 3 strings).",
      messages: [
        { "role": "user", "content": `Analyse these symptoms and return urgency level, chief complaint, and three suggested questions for the doctor. Symptoms: ${symptoms}` }
      ]
    });

    const resultText = msg.content[0].text;
    
    await db.query(
      "UPDATE appointments SET pre_visit_summary = $1, pre_visit_status = 'completed' WHERE id = $2",
      [resultText, appointmentId]
    );
  } catch (error) {
    console.error('LLM Pre-visit Failure:', error);
    await db.query("UPDATE appointments SET pre_visit_status = 'failed' WHERE id = $1", [appointmentId]);
  }
};

// Post-visit Summary
const generatePostVisitSummary = async (appointmentId, clinicalNotes) => {
  try {
    const msg = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 500,
      system: "You are a helpful medical assistant.",
      messages: [
        { "role": "user", "content": `Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: ${clinicalNotes}` }
      ]
    });

    const resultText = msg.content[0].text;

    await db.query(
      "UPDATE appointments SET post_visit_summary = $1 WHERE id = $2",
      [resultText, appointmentId]
    );
    return resultText;
  } catch (error) {
    console.error('LLM Post-visit Failure:', error);
    throw new Error('Failed to generate post-visit summary. Please rely on raw clinical notes.');
  }
};

module.exports = { analyzeSymptoms, generatePostVisitSummary };
