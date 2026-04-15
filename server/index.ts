import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from "@google/genai";
import { setupAuth, registerAuthRoutes, isAuthenticated, isAllowedEmailDomain, ALLOWED_EMAIL_DOMAIN } from "./replit_integrations/auth";
import { db } from "./db";
import { assessments, assessmentShares, users, csmRoster, csqlCallOverrides, csqlMatchConfidence, csqlExclusions } from "@shared/schema";
import { eq, desc, or, and, sql, inArray } from "drizzle-orm";
import { getQualifyingCalls, getTranscriptText, isSnowflakeConfigured, seedDefaultFilters, runSnowflakeQuery, getCSQLOpportunities, getCallsForAccount, getAccountConversationMap, getCSQLDuplicateCheck, getStageHistory, getStageAverages } from "./snowflake";
import { qualifyingCallFilters } from "@shared/schema";
import { asc } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const stageHistoryCache = new Map<string, { data: any; timestamp: number }>();
const STAGE_HISTORY_CACHE_TTL = 10 * 60 * 1000;

async function startServer() {
  console.log("Starting server setup...");
  
  console.log("Setting up auth...");
  await setupAuth(app);
  console.log("Auth setup complete");
  registerAuthRoutes(app);
  console.log("Auth routes registered");

  const isProductionStatic = process.env.NODE_ENV === 'production' || process.env.REPL_DEPLOYMENT === '1';
  if (isProductionStatic) {
    app.use(express.static(path.join(__dirname, '..')));
  }

  const MOVE_RUBRIC_CONTEXT = `
Discovery Quality – "How deep did we dig?"
Question: Did the CSM use open-ended, second-level questioning to uncover the root cause, rather than relying on a "checklist" interrogation style?
Score 1: The CSM adopted an "interrogation" style. They relied on rapid-fire, closed-ended (Yes/No) questions to fill out a form rather than having a conversation.
Score 2: The CSM asked basic open-ended questions ("What is your process?") but accepted the first answer given. They did not probe for specific examples or details.
Score 3: The CSM used follow-up prompts effectively (e.g., "Tell me more about that" or "Why is that important?"), moving beyond the surface but missing the emotional or personal context.
Score 4: The CSM "peeled the onion." They used the customer's previous answer to frame the next question, utilizing silence and "TED" (Tell, Explain, Describe) prompts to uncover the true root cause and personal context.

Motivation – "Why Now?"
Question: Did the CSM successfully uncover the "trigger" behind the conversation and distinguish between Interest (curiosity) and Intent (urgency)?
Score 1: The CSM treated the conversation as generic exploration. They did not ask "Why now?" or missed obvious timeline clues (e.g., "audit coming up," "Q1 rollout").
Score 2: The CSM asked why the customer was reaching out but accepted surface-level answers (e.g., "We just want to clean things up") without probing for the underlying driver.
Score 3: The CSM identified the trigger but did not clearly distinguish if it was just Interest or true Intent. They moved the conversation forward without confirming urgency.
Score 4: The CSM clearly distinguished Interest ❄️ vs. Intent 🔥. They uncovered the specific event driving the timeline (e.g., "We need this before the Q1 kickoff") and transitioned the conversation based on that urgency.

Opportunity – "What's the Impact?"
Question: Did the CSM connect the customer's change/request to a measurable business outcome, KPI, or specific problem?
Score 1: The CSM focused solely on features ("show-and-tell"). They explained how a feature works but never asked why the customer needed it or what problem it solved.
Score 2: The CSM asked high-level questions about the problem ("Would this help you?") but failed to quantify the impact or importance of solving it.
Score 3: The CSM identified the pain point but stopped short of connecting it to a business metric (e.g., "It will save time," but not "It will save 10 hours/week").
Score 4: The CSM connected the trigger to a measurable outcome (ROI, Risk, Efficiency). They asked high-value questions like, "If you hit that goal, what kind of impact would it have on the business?" or "if we were able to solve this, how would that impact your team?"

Validation – "Who needs to believe?"
Question: Did the CSM identify the decision-makers, champions, and the internal steps required for approval?
Score 1: The CSM assumed the person on the call was the sole decision-maker. No attempt was made to "multi-thread" or ask about other stakeholders.
Score 2: The CSM asked a binary question like "Do you need to check with anyone?" but didn't explore the criteria those people care about.
Score 3: The CSM identified who else needs to be involved (e.g., "I need to ask my VP") but did not arm the champion with the right data to win them over.
Score 4: The CSM mapped the buying committee and their specific needs. They asked questions like, "What would give your Ops Director confidence?" or "Who else needs to see results to be confident it's worth doing?"

Execution – "What's Next?"
Question: Did the CSM turn alignment into action by securing a firm commitment and clear next steps?
Score 1: The CSM ended with a passive "Let me know" or "Send me some info." No concrete next step was established. If there is no next step, it is still just Interest.
Score 2: The CSM suggested a next step ("Let's meet next week") but did not define an agenda or confirm if the timeline matched the customer's urgency.
Score 3: The CSM secured a meeting and an agenda, but failed to involve the necessary stakeholders identified in the Validation stage.
Score 4: The CSM aligned the next step specifically to the customer's timeline and goals. They secured a commitment (e.g., "Since you need this live by Q1, let's meet Tuesday to finalize the scope") and confirmed who should attend.
`;

  app.post('/api/analyze', isAuthenticated, async (req: any, res) => {
    try {
      const { transcript, accountName } = req.body;
      const userId = req.user?.claims?.sub;
      
      if (!transcript) {
        return res.status(400).json({ error: 'Transcript is required' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured' });
      }

      const ai = new GoogleGenAI({ apiKey });

      const prompt = `
        You are an expert Sales Coach. Analyze the following sales call transcript (or notes) and score it against the "MOVE" Rubric provided below.
        
        PART 1: MOVE RUBRIC DEFINITIONS:
        ${MOVE_RUBRIC_CONTEXT}

        TRANSCRIPT/NOTES:
        ${transcript}

        INSTRUCTIONS:
        
        1. MOVE SCORING: For each of the 5 categories, assign a score from 1 to 4 based strictly on the rubric criteria.
           Use these EXACT categoryId values:
           - "discovery" for Discovery Quality
           - "motivation" for Motivation
           - "opportunity" for Opportunity
           - "validation" for Validation
           - "execution" for Execution

        2. DETAILED ANALYSIS PER CATEGORY:
           - Observation: What happened? Describe the CSM's behavior concisely.
           - Evidence (CRITICAL): You MUST extract DIRECT QUOTES from the transcript to support your scoring.
           - The Gap: Specifically what was missed or done poorly that prevented a higher score?
           - Recommendation: The STRATEGIC advice.
           - Better Question: The TACTICAL script.

        3. STAKEHOLDER MAPPING: Identify key participants from the customer side.

        4. SUMMARY: Provide an executive summary, key strengths, and coaching tips.

        5. QA CHECKLIST: Evaluate the call against these binary criteria (Yes/No/NA):
           - Agenda, Decision Maker, Timeline, Competitors, Next Steps
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              scores: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    categoryId: { type: Type.STRING, enum: ["discovery", "motivation", "opportunity", "validation", "execution"] },
                    score: { type: Type.INTEGER },
                    reasoning: { type: Type.STRING },
                    gap: { type: Type.STRING },
                    quotes: { type: Type.ARRAY, items: { type: Type.STRING } },
                    betterQuestion: { type: Type.STRING },
                    recommendation: { type: Type.STRING }
                  },
                  required: ["categoryId", "score", "reasoning", "gap", "quotes", "betterQuestion", "recommendation"]
                }
              },
              stakeholders: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    title: { type: Type.STRING },
                    persona: { type: Type.STRING },
                    sentiment: { type: Type.STRING, enum: ["Positive", "Neutral", "Skeptical", "Negative", "Unknown"] },
                    influence: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
                    keyInterest: { type: Type.STRING },
                    missingInfo: { type: Type.BOOLEAN },
                    painPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                    businessGoal: { type: Type.STRING },
                    additionalNotes: { type: Type.STRING }
                  },
                  required: ["name", "title", "persona", "sentiment", "influence", "keyInterest", "missingInfo", "painPoints", "businessGoal", "additionalNotes"]
                }
              },
              executiveSummary: { type: Type.STRING },
              keyStrengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              coachingTips: { type: Type.ARRAY, items: { type: Type.STRING } },
              qa: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    label: { type: Type.STRING },
                    question: { type: Type.STRING },
                    status: { type: Type.STRING },
                    evidence: { type: Type.STRING }
                  },
                  required: ["id", "label", "question", "status"]
                }
              }
            },
            required: ["scores", "executiveSummary", "keyStrengths", "coachingTips", "stakeholders"]
          }
        }
      });

      const text = response.text;
      if (!text) {
        return res.status(500).json({ error: 'No response from AI' });
      }
      
      const analysisResult = JSON.parse(text);
      
      const totalScore = analysisResult.scores.reduce((sum: number, s: any) => sum + s.score, 0);
      
      const [saved] = await db.insert(assessments).values({
        userId,
        accountName: accountName || null,
        transcript,
        scores: analysisResult.scores,
        stakeholders: analysisResult.stakeholders,
        executiveSummary: analysisResult.executiveSummary,
        keyStrengths: analysisResult.keyStrengths,
        coachingTips: analysisResult.coachingTips,
        qa: analysisResult.qa,
        totalScore,
      }).returning();
      
      res.json({ ...analysisResult, id: saved.id });
    } catch (error) {
      console.error("AI Analysis Failed:", error);
      res.status(500).json({ error: 'Analysis failed' });
    }
  });

  app.post('/api/assessments/:id/rescore', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const assessmentId = Number(req.params.id);

      const [existing] = await db.select().from(assessments).where(eq(assessments.id, assessmentId));
      if (!existing) {
        return res.status(404).json({ error: 'Assessment not found' });
      }

      if (existing.userId !== userId) {
        return res.status(403).json({ error: 'You do not have permission to rescore this assessment' });
      }

      const transcript = existing.transcript;
      if (!transcript) {
        return res.status(400).json({ error: 'No transcript saved for this assessment — cannot rescore' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured' });
      }

      const ai = new GoogleGenAI({ apiKey });

      const prompt = `
        You are an expert Sales Coach. Analyze the following sales call transcript (or notes) and score it against the "MOVE" Rubric provided below.
        
        PART 1: MOVE RUBRIC DEFINITIONS:
        ${MOVE_RUBRIC_CONTEXT}

        TRANSCRIPT/NOTES:
        ${transcript}

        INSTRUCTIONS:
        
        1. MOVE SCORING: For each of the 5 categories, assign a score from 1 to 4 based strictly on the rubric criteria.
           Use these EXACT categoryId values:
           - "discovery" for Discovery Quality
           - "motivation" for Motivation
           - "opportunity" for Opportunity
           - "validation" for Validation
           - "execution" for Execution

        2. DETAILED ANALYSIS PER CATEGORY:
           - Observation: What happened? Describe the CSM's behavior concisely.
           - Evidence (CRITICAL): You MUST extract DIRECT QUOTES from the transcript to support your scoring.
           - The Gap: Specifically what was missed or done poorly that prevented a higher score?
           - Recommendation: The STRATEGIC advice.
           - Better Question: The TACTICAL script.

        3. STAKEHOLDER MAPPING: Identify key participants from the customer side.

        4. SUMMARY: Provide an executive summary, key strengths, and coaching tips.

        5. QA CHECKLIST: Evaluate the call against these binary criteria (Yes/No/NA):
           - Agenda, Decision Maker, Timeline, Competitors, Next Steps
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              scores: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    categoryId: { type: Type.STRING, enum: ["discovery", "motivation", "opportunity", "validation", "execution"] },
                    score: { type: Type.INTEGER },
                    reasoning: { type: Type.STRING },
                    gap: { type: Type.STRING },
                    quotes: { type: Type.ARRAY, items: { type: Type.STRING } },
                    betterQuestion: { type: Type.STRING },
                    recommendation: { type: Type.STRING }
                  },
                  required: ["categoryId", "score", "reasoning", "gap", "quotes", "betterQuestion", "recommendation"]
                }
              },
              stakeholders: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    title: { type: Type.STRING },
                    persona: { type: Type.STRING },
                    sentiment: { type: Type.STRING, enum: ["Positive", "Neutral", "Skeptical", "Negative", "Unknown"] },
                    influence: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
                    keyInterest: { type: Type.STRING },
                    missingInfo: { type: Type.BOOLEAN },
                    painPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                    businessGoal: { type: Type.STRING },
                    additionalNotes: { type: Type.STRING }
                  },
                  required: ["name", "title", "persona", "sentiment", "influence", "keyInterest", "missingInfo", "painPoints", "businessGoal", "additionalNotes"]
                }
              },
              executiveSummary: { type: Type.STRING },
              keyStrengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              coachingTips: { type: Type.ARRAY, items: { type: Type.STRING } },
              qa: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    label: { type: Type.STRING },
                    question: { type: Type.STRING },
                    status: { type: Type.STRING },
                    evidence: { type: Type.STRING }
                  },
                  required: ["id", "label", "question", "status"]
                }
              }
            },
            required: ["scores", "executiveSummary", "keyStrengths", "coachingTips", "stakeholders"]
          }
        }
      });

      const text = response.text;
      if (!text) {
        return res.status(500).json({ error: 'No response from AI' });
      }

      const analysisResult = JSON.parse(text);
      const totalScore = analysisResult.scores.reduce((sum: number, s: any) => sum + s.score, 0);

      await db.update(assessments)
        .set({
          scores: analysisResult.scores,
          stakeholders: analysisResult.stakeholders,
          executiveSummary: analysisResult.executiveSummary,
          keyStrengths: analysisResult.keyStrengths,
          coachingTips: analysisResult.coachingTips,
          qa: analysisResult.qa,
          totalScore,
        })
        .where(eq(assessments.id, assessmentId));

      res.json({ ...analysisResult, id: assessmentId });
    } catch (error) {
      console.error("Rescore Failed:", error);
      res.status(500).json({ error: 'Rescore failed' });
    }
  });

  app.get('/api/assessments', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { search, limit = 50, offset = 0 } = req.query;
      
      let query = db.select().from(assessments)
        .where(eq(assessments.userId, userId))
        .orderBy(desc(assessments.createdAt))
        .limit(Number(limit))
        .offset(Number(offset));
      
      const results = await query;
      res.json(results);
    } catch (error) {
      console.error("Error fetching assessments:", error);
      res.status(500).json({ error: 'Failed to fetch assessments' });
    }
  });

  app.get('/api/assessments/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const assessmentId = Number(req.params.id);
      
      const [assessment] = await db.select().from(assessments)
        .where(eq(assessments.id, assessmentId));
      
      if (!assessment) {
        return res.status(404).json({ error: 'Assessment not found' });
      }
      
      if (assessment.userId !== userId) {
        const isGongAssessment = !!assessment.gongConversationId;
        if (!isGongAssessment) {
          const [share] = await db.select().from(assessmentShares)
            .where(and(
              eq(assessmentShares.assessmentId, assessmentId),
              eq(assessmentShares.sharedWithUserId, userId)
            ));

          if (!share) {
            return res.status(403).json({ error: 'Access denied' });
          }
        }
      }
      
      res.json(assessment);
    } catch (error) {
      console.error("Error fetching assessment:", error);
      res.status(500).json({ error: 'Failed to fetch assessment' });
    }
  });

  app.get('/api/assessments/shared/with-me', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      
      const shares = await db.select({
        assessment: assessments,
        share: assessmentShares,
        sharedBy: users,
      })
        .from(assessmentShares)
        .innerJoin(assessments, eq(assessmentShares.assessmentId, assessments.id))
        .innerJoin(users, eq(assessmentShares.sharedByUserId, users.id))
        .where(eq(assessmentShares.sharedWithUserId, userId))
        .orderBy(desc(assessmentShares.createdAt));
      
      res.json(shares);
    } catch (error) {
      console.error("Error fetching shared assessments:", error);
      res.status(500).json({ error: 'Failed to fetch shared assessments' });
    }
  });

  app.post('/api/assessments/:id/share', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const assessmentId = Number(req.params.id);
      const { email, permission = 'view' } = req.body;
      
      if (!isAllowedEmailDomain(email)) {
        return res.status(400).json({ error: `Can only share with ${ALLOWED_EMAIL_DOMAIN} email addresses` });
      }
      
      const [assessment] = await db.select().from(assessments)
        .where(eq(assessments.id, assessmentId));
      
      if (!assessment || assessment.userId !== userId) {
        return res.status(403).json({ error: 'Cannot share this assessment' });
      }
      
      const [targetUser] = await db.select().from(users)
        .where(eq(users.email, email));
      
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found. They need to log in first.' });
      }
      
      const [existing] = await db.select().from(assessmentShares)
        .where(and(
          eq(assessmentShares.assessmentId, assessmentId),
          eq(assessmentShares.sharedWithUserId, targetUser.id)
        ));
      
      if (existing) {
        return res.status(400).json({ error: 'Already shared with this user' });
      }
      
      const [share] = await db.insert(assessmentShares).values({
        assessmentId,
        sharedByUserId: userId,
        sharedWithUserId: targetUser.id,
        permission,
      }).returning();
      
      res.json(share);
    } catch (error) {
      console.error("Error sharing assessment:", error);
      res.status(500).json({ error: 'Failed to share assessment' });
    }
  });

  app.delete('/api/assessments/:id/share/:shareId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const assessmentId = Number(req.params.id);
      const shareId = Number(req.params.shareId);
      
      const [assessment] = await db.select().from(assessments)
        .where(eq(assessments.id, assessmentId));
      
      if (!assessment || assessment.userId !== userId) {
        return res.status(403).json({ error: 'Cannot modify shares for this assessment' });
      }
      
      await db.delete(assessmentShares).where(eq(assessmentShares.id, shareId));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing share:", error);
      res.status(500).json({ error: 'Failed to remove share' });
    }
  });

  app.get('/api/trends', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      
      const userAssessments = await db.select({
        id: assessments.id,
        totalScore: assessments.totalScore,
        scores: assessments.scores,
        createdAt: assessments.createdAt,
        accountName: assessments.accountName,
        gongMetadata: assessments.gongMetadata,
      })
        .from(assessments)
        .where(eq(assessments.userId, userId))
        .orderBy(assessments.createdAt);
      
      const trends = userAssessments.map((a, index) => {
        const scoresData = a.scores as any[];
        const categoryScores: Record<string, number> = {};
        scoresData?.forEach((s: any) => {
          categoryScores[s.categoryId] = s.score;
        });
        const meta = a.gongMetadata as any;
        const effectiveDate = meta?.callDate || a.createdAt;
        
        return {
          index: index + 1,
          date: effectiveDate,
          accountName: a.accountName,
          totalScore: a.totalScore,
          ...categoryScores,
        };
      });
      
      const avgByCategory: Record<string, number> = {};
      const categories = ['discovery', 'motivation', 'opportunity', 'validation', 'execution'];
      
      categories.forEach(cat => {
        const scores = trends.map(t => (t as any)[cat]).filter(Boolean);
        avgByCategory[cat] = scores.length > 0 
          ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 
          : 0;
      });
      
      res.json({
        trends,
        averages: avgByCategory,
        totalAssessments: userAssessments.length,
        averageTotalScore: userAssessments.length > 0 
          ? Math.round((userAssessments.reduce((sum, a) => sum + (a.totalScore || 0), 0) / userAssessments.length) * 10) / 10
          : 0,
      });
    } catch (error) {
      console.error("Error fetching trends:", error);
      res.status(500).json({ error: 'Failed to fetch trends' });
    }
  });

  app.get('/api/trends/team', isAuthenticated, async (req: any, res) => {
    try {
      const allAssessments = await db.select({
        id: assessments.id,
        userId: assessments.userId,
        totalScore: assessments.totalScore,
        scores: assessments.scores,
        createdAt: assessments.createdAt,
        accountName: assessments.accountName,
        gongMetadata: assessments.gongMetadata,
      })
        .from(assessments)
        .where(sql`${assessments.totalScore} IS NOT NULL`)
        .orderBy(assessments.createdAt);

      const allUsers = await db.select().from(users);
      const userMap = new Map(allUsers.map(u => [u.id, u]));

      const roster = await db.select().from(csmRoster);
      const normalizeName = (name: string) => name.toLowerCase().replace(/['']/g, "'").replace(/\s+/g, ' ').trim();
      const rosterMap = new Map<string, typeof roster[0]>();
      for (const r of roster) {
        rosterMap.set(normalizeName(r.name), r);
      }

      const trends = allAssessments.map((a, index) => {
        const scoresData = a.scores as any[];
        const categoryScores: Record<string, number> = {};
        scoresData?.forEach((s: any) => {
          categoryScores[s.categoryId] = s.score;
        });
        const user = userMap.get(a.userId);
        const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown' : 'Unknown';
        const meta = a.gongMetadata as any;
        const effectiveDate = meta?.callDate || a.createdAt;
        const csmName = meta?.csmName || null;
        const rosterEntry = csmName ? rosterMap.get(normalizeName(csmName)) : null;

        return {
          index: index + 1,
          date: effectiveDate,
          accountName: a.accountName,
          totalScore: a.totalScore,
          userName,
          csmName: csmName || userName,
          manager: rosterEntry?.manager || null,
          ...categoryScores,
        };
      });

      const avgByCategory: Record<string, number> = {};
      const categories = ['discovery', 'motivation', 'opportunity', 'validation', 'execution'];

      categories.forEach(cat => {
        const scores = trends.map(t => (t as any)[cat]).filter(Boolean);
        avgByCategory[cat] = scores.length > 0
          ? Math.round((scores.reduce((a: number, b: number) => a + b, 0) / scores.length) * 10) / 10
          : 0;
      });

      res.json({
        trends,
        averages: avgByCategory,
        totalAssessments: allAssessments.length,
        averageTotalScore: allAssessments.length > 0
          ? Math.round((allAssessments.reduce((sum, a) => sum + (a.totalScore || 0), 0) / allAssessments.length) * 10) / 10
          : 0,
      });
    } catch (error) {
      console.error("Error fetching team trends:", error);
      res.status(500).json({ error: 'Failed to fetch team trends' });
    }
  });

  app.get('/api/users/search', isAuthenticated, async (req: any, res) => {
    try {
      const { email } = req.query;
      if (!email) {
        return res.status(400).json({ error: 'Email query required' });
      }
      
      const foundUsers = await db.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
        .from(users)
        .where(sql`${users.email} ILIKE ${`%${email}%`}`)
        .limit(10);
      
      res.json(foundUsers);
    } catch (error) {
      console.error("Error searching users:", error);
      res.status(500).json({ error: 'Failed to search users' });
    }
  });

  // --- Gong Integration Endpoints ---

  app.get('/api/gong/qualifying-calls', isAuthenticated, async (req: any, res) => {
    try {
      if (!isSnowflakeConfigured()) {
        return res.status(503).json({ error: 'Snowflake integration not configured' });
      }

      const calls = await getQualifyingCalls();

      const analyzedCalls = await db.select({
          gongConversationId: assessments.gongConversationId,
          id: assessments.id,
          userId: assessments.userId,
          accountName: assessments.accountName,
          totalScore: assessments.totalScore,
        })
        .from(assessments)
        .where(sql`${assessments.gongConversationId} IS NOT NULL`);

      const analyzedMap = new Map(analyzedCalls.map(a => [a.gongConversationId, a]));
      const allUsers = await db.select().from(users);
      const userMap = new Map(allUsers.map(u => [u.id, u]));

      const enrichedCalls = calls.map(call => {
        const analyzed = analyzedMap.get(call.CONVERSATION_ID);
        const analyzedByUser = analyzed ? userMap.get(analyzed.userId) : null;
        return {
          conversationId: call.CONVERSATION_ID,
          title: call.CALL_TITLE,
          callDate: call.CALL_DATE,
          callUrl: `https://app.gong.io/call?id=${call.CONVERSATION_ID}`,
          csmName: call.CSM_NAME,
          durationMins: call.DURATION_MINS,
          opportunityName: call.OPPORTUNITY_NAME,
          renewalDate: call.RENEWAL_DATE,
          daysUntilRenewal: call.DAYS_UNTIL_RENEWAL,
          matchedKeywords: (call.MATCHED_KEYWORDS && call.MATCHED_KEYWORDS.trim()) || null,
          alreadyAnalyzed: !!analyzed,
          assessmentId: analyzed?.id || null,
          assessmentScore: analyzed?.totalScore || null,
          analyzedBy: analyzedByUser ? `${analyzedByUser.firstName || ''} ${analyzedByUser.lastName || ''}`.trim() || analyzedByUser.email : null,
        };
      });

      res.json({
        calls: enrichedCalls,
        total: enrichedCalls.length,
      });
    } catch (error) {
      console.error("Error fetching qualifying calls:", error);
      res.status(500).json({ error: 'Failed to fetch qualifying calls from Snowflake' });
    }
  });

  app.post('/api/gong/backfill-call-dates', isAuthenticated, async (req: any, res) => {
    try {
      if (!isSnowflakeConfigured()) {
        return res.status(503).json({ error: 'Snowflake integration not configured' });
      }

      const assessmentsWithGong = await db.select({
        id: assessments.id,
        gongConversationId: assessments.gongConversationId,
        gongMetadata: assessments.gongMetadata,
      })
        .from(assessments)
        .where(sql`${assessments.gongConversationId} IS NOT NULL AND ${assessments.totalScore} IS NOT NULL`);

      const needsBackfill = assessmentsWithGong.filter(a => {
        const meta = a.gongMetadata as any;
        return !meta?.callDate;
      });

      if (needsBackfill.length === 0) {
        return res.json({ updated: 0, message: 'All assessments already have call dates' });
      }

      const convIds = needsBackfill.map(a => `'${a.gongConversationId}'`).join(',');
      const dateQuery = `SELECT CONVERSATION_ID, PLANNED_START_DATETIME::DATE AS CALL_DATE FROM CLEAN.GONG.CALLS WHERE CONVERSATION_ID IN (${convIds})`;
      const rows = await runSnowflakeQuery<{ CONVERSATION_ID: string; CALL_DATE: string }>(dateQuery);

      const dateMap = new Map<string, string>();
      for (const row of rows) {
        dateMap.set(String(row.CONVERSATION_ID), String(row.CALL_DATE));
      }

      let updated = 0;
      for (const a of needsBackfill) {
        const callDate = dateMap.get(String(a.gongConversationId));
        if (callDate) {
          const meta = (a.gongMetadata || {}) as any;
          await db.update(assessments)
            .set({ gongMetadata: { ...meta, callDate } })
            .where(eq(assessments.id, a.id));
          updated++;
        }
      }

      res.json({ updated, total: needsBackfill.length });
    } catch (error) {
      console.error("Error backfilling call dates:", error);
      res.status(500).json({ error: 'Failed to backfill call dates' });
    }
  });

  app.get('/api/gong/transcript/:conversationId', isAuthenticated, async (req: any, res) => {
    try {
      if (!isSnowflakeConfigured()) {
        return res.status(503).json({ error: 'Snowflake integration not configured' });
      }

      const { conversationId } = req.params;
      const transcript = await getTranscriptText(conversationId);
      res.json({ conversationId, transcript });
    } catch (error) {
      console.error("Error fetching transcript:", error);
      res.status(500).json({ error: 'Failed to fetch transcript from Snowflake' });
    }
  });

  app.post('/api/gong/analyze', isAuthenticated, async (req: any, res) => {
    try {
      if (!isSnowflakeConfigured()) {
        return res.status(503).json({ error: 'Snowflake integration not configured' });
      }

      const userId = req.user?.claims?.sub;
      const { conversationIds } = req.body;

      if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
        return res.status(400).json({ error: 'conversationIds array is required' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured' });
      }

      const { GoogleGenAI, Type } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });

      const results: Array<{ conversationId: string; assessmentId: number; success: boolean; error?: string }> = [];

      for (const conversationId of conversationIds) {
        try {
          // Check if already analyzed
          const [existing] = await db.select({ id: assessments.id })
            .from(assessments)
            .where(eq(assessments.gongConversationId, conversationId));

          if (existing) {
            results.push({ conversationId, assessmentId: existing.id, success: true });
            continue;
          }

          // Fetch transcript from Snowflake
          const transcript = await getTranscriptText(conversationId);

          // Fetch call metadata for account name
          const calls = await getQualifyingCalls();
          const callMeta = calls.find(c => c.CONVERSATION_ID === conversationId);
          const accountName = callMeta?.OPPORTUNITY_NAME?.split(' - ')[0] || callMeta?.CALL_TITLE || 'Gong Call';

          // Run Gemini analysis (reuse existing prompt from /api/analyze)
          const prompt = `
            You are an expert Sales Coach. Analyze the following sales call transcript (or notes) and score it against the "MOVE" Rubric provided below.

            PART 1: MOVE RUBRIC DEFINITIONS:
            ${MOVE_RUBRIC_CONTEXT}

            TRANSCRIPT/NOTES:
            ${transcript}

            INSTRUCTIONS:

            1. MOVE SCORING: For each of the 5 categories, assign a score from 1 to 4 based strictly on the rubric criteria.
               Use these EXACT categoryId values:
               - "discovery" for Discovery Quality
               - "motivation" for Motivation
               - "opportunity" for Opportunity
               - "validation" for Validation
               - "execution" for Execution

            2. DETAILED ANALYSIS PER CATEGORY:
               - Observation: What happened? Describe the CSM's behavior concisely.
               - Evidence (CRITICAL): You MUST extract DIRECT QUOTES from the transcript to support your scoring.
               - The Gap: Specifically what was missed or done poorly that prevented a higher score?
               - Recommendation: The STRATEGIC advice.
               - Better Question: The TACTICAL script.

            3. STAKEHOLDER MAPPING: Identify key participants from the customer side.

            4. SUMMARY: Provide an executive summary, key strengths, and coaching tips.

            5. QA CHECKLIST: Evaluate the call against these binary criteria (Yes/No/NA):
               - Agenda, Decision Maker, Timeline, Competitors, Next Steps
          `;

          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  scores: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        categoryId: { type: Type.STRING, enum: ["discovery", "motivation", "opportunity", "validation", "execution"] },
                        score: { type: Type.INTEGER },
                        reasoning: { type: Type.STRING },
                        gap: { type: Type.STRING },
                        quotes: { type: Type.ARRAY, items: { type: Type.STRING } },
                        betterQuestion: { type: Type.STRING },
                        recommendation: { type: Type.STRING }
                      },
                      required: ["categoryId", "score", "reasoning", "gap", "quotes", "betterQuestion", "recommendation"]
                    }
                  },
                  stakeholders: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        title: { type: Type.STRING },
                        persona: { type: Type.STRING },
                        sentiment: { type: Type.STRING, enum: ["Positive", "Neutral", "Skeptical", "Negative", "Unknown"] },
                        influence: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
                        keyInterest: { type: Type.STRING },
                        missingInfo: { type: Type.BOOLEAN },
                        painPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                        businessGoal: { type: Type.STRING },
                        additionalNotes: { type: Type.STRING }
                      },
                      required: ["name", "title", "persona", "sentiment", "influence", "keyInterest", "missingInfo", "painPoints", "businessGoal", "additionalNotes"]
                    }
                  },
                  executiveSummary: { type: Type.STRING },
                  keyStrengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                  coachingTips: { type: Type.ARRAY, items: { type: Type.STRING } },
                  qa: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        label: { type: Type.STRING },
                        question: { type: Type.STRING },
                        status: { type: Type.STRING },
                        evidence: { type: Type.STRING }
                      },
                      required: ["id", "label", "question", "status"]
                    }
                  }
                },
                required: ["scores", "executiveSummary", "keyStrengths", "coachingTips", "stakeholders"]
              }
            }
          });

          const text = response.text;
          if (!text) {
            results.push({ conversationId, assessmentId: 0, success: false, error: 'No response from AI' });
            continue;
          }

          const analysisResult = JSON.parse(text);
          const totalScore = analysisResult.scores.reduce((sum: number, s: any) => sum + s.score, 0);

          const [saved] = await db.insert(assessments).values({
            userId,
            accountName,
            transcript,
            scores: analysisResult.scores,
            stakeholders: analysisResult.stakeholders,
            executiveSummary: analysisResult.executiveSummary,
            keyStrengths: analysisResult.keyStrengths,
            coachingTips: analysisResult.coachingTips,
            qa: analysisResult.qa,
            totalScore,
            source: "gong",
            gongConversationId: conversationId,
            gongMetadata: {
              callUrl: callMeta?.CALL_URL,
              csmName: callMeta?.CSM_NAME,
              callDate: callMeta?.CALL_DATE || null,
              renewalDate: callMeta?.RENEWAL_DATE,
              opportunityName: callMeta?.OPPORTUNITY_NAME,
              daysUntilRenewal: callMeta?.DAYS_UNTIL_RENEWAL,
              durationMins: callMeta?.DURATION_MINS,
            },
          }).returning();

          results.push({ conversationId, assessmentId: saved.id, success: true });
        } catch (callError: any) {
          console.error(`Error analyzing call ${conversationId}:`, callError);
          results.push({ conversationId, assessmentId: 0, success: false, error: callError.message });
        }
      }

      res.json({
        results,
        succeeded: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      });
    } catch (error) {
      console.error("Error in batch Gong analysis:", error);
      res.status(500).json({ error: 'Batch analysis failed' });
    }
  });

  // --- Qualifying Filter Endpoints ---

  app.get('/api/leaderboard', isAuthenticated, async (req: any, res) => {
    try {
      const manager = typeof req.query.manager === 'string' ? req.query.manager : undefined;
      const segment = typeof req.query.segment === 'string' ? req.query.segment : undefined;
      const attachment = typeof req.query.attachment === 'string' ? req.query.attachment : undefined;

      const allAssessments = await db
        .select({
          userId: assessments.userId,
          scores: assessments.scores,
          totalScore: assessments.totalScore,
          gongMetadata: assessments.gongMetadata,
          gongConversationId: assessments.gongConversationId,
        })
        .from(assessments)
        .where(sql`${assessments.totalScore} IS NOT NULL`);

      const roster = await db.select().from(csmRoster);
      const normalizeName = (name: string) => name.toLowerCase().replace(/['']/g, "'").replace(/\s+/g, ' ').trim();
      const rosterMap = new Map<string, typeof roster[0]>();
      for (const r of roster) {
        rosterMap.set(normalizeName(r.name), r);
      }

      const allUsers = await db.select().from(users);
      const userMap = new Map(allUsers.map(u => [u.id, u]));

      const PHASES = ['discovery', 'motivation', 'opportunity', 'validation', 'execution'] as const;

      const byCsm = new Map<string, {
        totalScores: number[];
        phaseScores: Record<string, number[]>;
        assessmentCount: number;
        rosterEntry: typeof roster[0] | null;
      }>();

      for (const a of allAssessments) {
        let csmName: string | null = null;
        const meta = a.gongMetadata as any;
        if (meta?.csmName) {
          csmName = String(meta.csmName).trim();
        }

        if (!csmName) {
          const user = userMap.get(a.userId);
          csmName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown' : 'Unknown';
        }

        const rosterEntry = rosterMap.get(normalizeName(csmName)) || null;

        if (manager && rosterEntry?.manager !== manager) continue;
        if (segment && rosterEntry?.segment !== segment) continue;
        if (attachment && rosterEntry?.attachment !== attachment) continue;

        if (!byCsm.has(csmName)) {
          byCsm.set(csmName, {
            totalScores: [],
            phaseScores: Object.fromEntries(PHASES.map(p => [p, []])),
            assessmentCount: 0,
            rosterEntry,
          });
        }
        const entry = byCsm.get(csmName)!;
        entry.assessmentCount++;
        if (a.totalScore != null) {
          entry.totalScores.push(a.totalScore);
        }
        const scoresArr = a.scores as any[];
        if (Array.isArray(scoresArr)) {
          for (const s of scoresArr) {
            if (s.categoryId && typeof s.score === 'number' && entry.phaseScores[s.categoryId]) {
              entry.phaseScores[s.categoryId].push(s.score);
            }
          }
        }
      }

      const avg = (arr: number[]) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;

      const leaderboard = Array.from(byCsm.entries()).map(([csmName, data]) => {
        return {
          csmName,
          segment: data.rosterEntry?.segment || null,
          attachment: data.rosterEntry?.attachment || null,
          manager: data.rosterEntry?.manager || null,
          assessmentCount: data.assessmentCount,
          averageTotal: avg(data.totalScores),
          maxTotal: 20,
          phases: Object.fromEntries(
            PHASES.map(p => [p, {
              average: avg(data.phaseScores[p]),
              count: data.phaseScores[p].length,
            }])
          ),
        };
      });

      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
  });

  app.get('/api/csql-outcomes', isAuthenticated, async (req: any, res) => {
    try {
      if (!isSnowflakeConfigured()) {
        return res.status(503).json({ error: 'Snowflake integration not configured' });
      }

      const [csqls, accountConvMap] = await Promise.all([
        getCSQLOpportunities(),
        getAccountConversationMap(),
      ]);

      const allAssessments = await db
        .select({
          id: assessments.id,
          accountName: assessments.accountName,
          totalScore: assessments.totalScore,
          scores: assessments.scores,
          gongConversationId: assessments.gongConversationId,
          gongMetadata: assessments.gongMetadata,
          createdAt: assessments.createdAt,
        })
        .from(assessments)
        .where(sql`${assessments.totalScore} IS NOT NULL`);

      const roster = await db.select().from(csmRoster);
      const normalizeName = (name: string) => name.toLowerCase().replace(/['']/g, "'").replace(/\s+/g, ' ').trim();
      const rosterMap = new Map<string, typeof roster[0]>();
      for (const r of roster) {
        rosterMap.set(normalizeName(r.name), r);
      }

      const assessmentsByConvId = new Map<string, typeof allAssessments[0]>();
      const assessmentsById = new Map<number, typeof allAssessments[0]>();
      for (const a of allAssessments) {
        assessmentsById.set(a.id, a);
        if (a.gongConversationId) {
          assessmentsByConvId.set(a.gongConversationId, a);
        }
      }

      const overrides = await db.select().from(csqlCallOverrides);
      const overrideMap = new Map<string, typeof overrides[0]>();
      for (const o of overrides) {
        overrideMap.set(o.oppId, o);
      }

      const matchConfidences = await db.select().from(csqlMatchConfidence);
      const matchConfidenceMap = new Map<string, { confidence: string; reasoning: string | null; isManual: boolean }>();
      for (const mc of matchConfidences) {
        matchConfidenceMap.set(mc.oppId, { confidence: mc.confidence, reasoning: mc.reasoning, isManual: mc.isManual ?? false });
      }

      const exclusions = await db.select().from(csqlExclusions);
      const exclusionSet = new Set(exclusions.map(e => e.oppId));

      const getCallDate = (a: typeof allAssessments[0], convCallDate?: string): Date | null => {
        const meta = a.gongMetadata as any;
        if (meta?.callDate) {
          const d = new Date(meta.callDate);
          if (!isNaN(d.getTime())) return d;
        }
        if (convCallDate) {
          const d = new Date(convCallDate);
          if (!isNaN(d.getTime())) return d;
        }
        if (a.createdAt) return new Date(a.createdAt);
        return null;
      };

      const results = csqls.map(csql => {
        const override = overrideMap.get(csql.OPP_ID);

        let bestMatch: typeof allAssessments[0] | null = null;
        let bestCallDate: Date | null = null;
        let isOverridden = false;

        if (override) {
          const overriddenAssessment = assessmentsById.get(override.assessmentId);
          if (overriddenAssessment) {
            bestMatch = overriddenAssessment;
            bestCallDate = getCallDate(overriddenAssessment);
            isOverridden = true;
          }
        }

        if (!bestMatch) {
          const oppCreatedDate = new Date(csql.CREATED_DATE);
          const windowStart = new Date(oppCreatedDate);
          windowStart.setDate(windowStart.getDate() - 180);
          const cutoff = new Date(oppCreatedDate);
          cutoff.setHours(cutoff.getHours() + 24);

          const accountConversations = accountConvMap.get(csql.ACCOUNT_ID) || [];

          for (const conv of accountConversations) {
            const assessment = assessmentsByConvId.get(conv.conversationId);
            if (!assessment) continue;

            const callDate = getCallDate(assessment, conv.callDate);
            if (!callDate) continue;

            if (callDate <= cutoff && callDate >= windowStart) {
              if (!bestMatch || callDate > bestCallDate!) {
                bestMatch = assessment;
                bestCallDate = callDate;
              }
            }
          }
        }

        let closedStatus = 'Open';
        const isClosed = csql.IS_CLOSED === true || String(csql.IS_CLOSED).toLowerCase() === 'true';
        if (isClosed) {
          closedStatus = csql.STAGE_NAME.toLowerCase().includes('won') ? 'Closed Won' : 'Closed Lost';
        }

        const creatorRoster = rosterMap.get(normalizeName(csql.CREATED_BY_NAME));

        return {
          oppId: csql.OPP_ID,
          oppName: csql.OPP_NAME,
          accountName: csql.ACCOUNT_NAME,
          amount: csql.AMOUNT,
          stageName: csql.STAGE_NAME,
          createdDate: csql.CREATED_DATE,
          closeDate: csql.CLOSE_DATE,
          createdByName: csql.CREATED_BY_NAME,
          closedStatus,
          creatorSegment: creatorRoster?.segment || null,
          creatorManager: creatorRoster?.manager || null,
          isOverridden,
          linkedAssessment: bestMatch ? {
            assessmentId: bestMatch.id,
            totalScore: bestMatch.totalScore,
            callDate: bestCallDate?.toISOString().split('T')[0] || null,
            gongConversationId: bestMatch.gongConversationId,
            scores: bestMatch.scores,
          } : null,
          matchConfidence: matchConfidenceMap.get(csql.OPP_ID) || null,
          isExcluded: exclusionSet.has(csql.OPP_ID),
        };
      });

      const totalCSQLs = results.length;
      const linkedCount = results.filter(r => r.linkedAssessment).length;
      const closedWon = results.filter(r => r.closedStatus === 'Closed Won');
      const closedLost = results.filter(r => r.closedStatus === 'Closed Lost');
      const openDeals = results.filter(r => r.closedStatus === 'Open');

      const totalPipeline = results.reduce((sum, r) => sum + (r.amount || 0), 0);
      const wonPipeline = closedWon.reduce((sum, r) => sum + (r.amount || 0), 0);
      const linkedScores = results.filter(r => r.linkedAssessment?.totalScore != null).map(r => r.linkedAssessment!.totalScore!);
      const avgLinkedScore = linkedScores.length ? Math.round((linkedScores.reduce((a, b) => a + b, 0) / linkedScores.length) * 10) / 10 : null;

      const wonScores = closedWon.filter(r => r.linkedAssessment?.totalScore != null).map(r => r.linkedAssessment!.totalScore!);
      const lostScores = closedLost.filter(r => r.linkedAssessment?.totalScore != null).map(r => r.linkedAssessment!.totalScore!);
      const avgWonScore = wonScores.length ? Math.round((wonScores.reduce((a, b) => a + b, 0) / wonScores.length) * 10) / 10 : null;
      const avgLostScore = lostScores.length ? Math.round((lostScores.reduce((a, b) => a + b, 0) / lostScores.length) * 10) / 10 : null;

      const winRate = (closedWon.length + closedLost.length) > 0
        ? Math.round((closedWon.length / (closedWon.length + closedLost.length)) * 100)
        : null;

      const stageDistribution: Record<string, { count: number; pipeline: number }> = {};
      for (const r of results) {
        const stage = r.stageName || 'Unknown';
        if (!stageDistribution[stage]) {
          stageDistribution[stage] = { count: 0, pipeline: 0 };
        }
        stageDistribution[stage].count++;
        stageDistribution[stage].pipeline += r.amount || 0;
      }

      res.json({
        csqls: results,
        roster: roster.map(r => ({ name: r.name, manager: r.manager })),
        summary: {
          totalCSQLs,
          linkedCount,
          closedWonCount: closedWon.length,
          closedLostCount: closedLost.length,
          openCount: openDeals.length,
          totalPipeline,
          wonPipeline,
          avgLinkedScore,
          avgWonScore,
          avgLostScore,
          winRate,
          stageDistribution,
        },
      });
    } catch (error) {
      console.error("Error fetching CSQL outcomes:", error);
      res.status(500).json({ error: 'Failed to fetch CSQL outcomes' });
    }
  });

  app.get('/api/csm-roster', isAuthenticated, async (req: any, res) => {
    try {
      const roster = await db
        .select({ name: csmRoster.name, manager: csmRoster.manager })
        .from(csmRoster)
        .orderBy(csmRoster.manager, csmRoster.name);
      res.json({ roster });
    } catch (err) {
      console.error('Error fetching CSM roster:', err);
      res.status(500).json({ error: 'Failed to fetch CSM roster' });
    }
  });

  app.get('/api/csql-unscored-count', isAuthenticated, async (req: any, res) => {
    try {
      if (!isSnowflakeConfigured()) {
        return res.json({ unscoredCount: 0 });
      }

      const [csqls, accountConvMap] = await Promise.all([
        getCSQLOpportunities(),
        getAccountConversationMap(),
      ]);

      const allAssessments = await db
        .select({
          id: assessments.id,
          gongConversationId: assessments.gongConversationId,
          gongMetadata: assessments.gongMetadata,
          createdAt: assessments.createdAt,
        })
        .from(assessments)
        .where(sql`${assessments.totalScore} IS NOT NULL`);

      const assessmentsByConvId = new Map<string, typeof allAssessments[0]>();
      const assessmentsById = new Map<number, typeof allAssessments[0]>();
      for (const a of allAssessments) {
        assessmentsById.set(a.id, a);
        if (a.gongConversationId) {
          assessmentsByConvId.set(a.gongConversationId, a);
        }
      }

      const overrides = await db.select().from(csqlCallOverrides);
      const overrideMap = new Map<string, typeof overrides[0]>();
      for (const o of overrides) {
        overrideMap.set(o.oppId, o);
      }

      let unscoredCount = 0;
      for (const csql of csqls) {
        const override = overrideMap.get(csql.OPP_ID);
        if (override) {
          const overrideAssessment = assessmentsById.get(override.assessmentId);
          if (overrideAssessment) continue;
        }

        const sfAccountId = csql.ACCOUNT_ID;
        const convIds = sfAccountId ? (accountConvMap.get(sfAccountId) || []) : [];
        let hasMatch = false;
        for (const convId of convIds) {
          if (assessmentsByConvId.has(convId)) {
            hasMatch = true;
            break;
          }
        }
        if (!hasMatch) unscoredCount++;
      }

      res.json({ unscoredCount });
    } catch (error) {
      console.error("Error fetching CSQL unscored count:", error);
      res.json({ unscoredCount: 0 });
    }
  });

  app.get('/api/csql-duplicate-check', isAuthenticated, async (req: any, res) => {
    try {
      if (!isSnowflakeConfigured()) {
        return res.status(503).json({ error: 'Snowflake integration not configured' });
      }
      const results = await getCSQLDuplicateCheck();
      res.json({ results, total: results.reduce((sum, r) => sum + Number(r.CNT), 0) });
    } catch (error: any) {
      console.error('CSQL duplicate check error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/csql-stage-history', isAuthenticated, async (req: any, res) => {
    try {
      if (!isSnowflakeConfigured()) {
        return res.status(503).json({ error: 'Snowflake not configured' });
      }
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;
      const cacheKey = `${from ?? "all"}|${to ?? "all"}`;
      const cached = stageHistoryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < STAGE_HISTORY_CACHE_TTL) {
        return res.json(cached.data);
      }
      const csqls = await getCSQLOpportunities();
      const oppIds = csqls.map(c => c.OPP_ID);
      const [historyRows, stageAvgRows] = await Promise.all([
        getStageHistory(oppIds),
        getStageAverages(from, to),
      ]);
      // Group history rows by opp, sorted ASC (already sorted by query)
      const historyByOpp = new Map<string, { STAGE_NAME: string; CREATED_DATE: string }[]>();
      for (const row of historyRows) {
        const list = historyByOpp.get(row.OPPORTUNITY_ID) ?? [];
        list.push({ STAGE_NAME: row.STAGE_NAME, CREATED_DATE: row.CREATED_DATE });
        historyByOpp.set(row.OPPORTUNITY_ID, list);
      }
      // Compute days in current stage per opp
      const today = new Date();
      const perOpp: Record<string, number> = {};
      for (const csql of csqls) {
        const history = historyByOpp.get(csql.OPP_ID) ?? [];
        const currentStage = csql.STAGE_NAME;
        // Walk history to find most recent entry INTO the current stage
        let lastEnteredCurrentStage: Date | null = null;
        let prevStage: string | null = null;
        for (const row of history) {
          if (row.STAGE_NAME === currentStage && prevStage !== currentStage) {
            lastEnteredCurrentStage = new Date(row.CREATED_DATE);
          }
          prevStage = row.STAGE_NAME;
        }
        const enteredAt = lastEnteredCurrentStage ?? new Date(csql.CREATED_DATE);
        const days = Math.max(0, Math.floor((today.getTime() - enteredAt.getTime()) / 86400000));
        perOpp[csql.OPP_ID] = days;
      }
      // Format stage averages keyed by stage name
      const stageAvgMap: Record<string, { avgDaysWon: number | null; avgDaysLost: number | null; wonCount: number; lostCount: number }> = {};
      for (const row of stageAvgRows) {
        if (!stageAvgMap[row.STAGE_NAME]) {
          stageAvgMap[row.STAGE_NAME] = { avgDaysWon: null, avgDaysLost: null, wonCount: 0, lostCount: 0 };
        }
        if (row.OUTCOME === 'won') {
          stageAvgMap[row.STAGE_NAME].avgDaysWon = Number(row.AVG_DAYS);
          stageAvgMap[row.STAGE_NAME].wonCount = Number(row.DEAL_COUNT);
        } else {
          stageAvgMap[row.STAGE_NAME].avgDaysLost = Number(row.AVG_DAYS);
          stageAvgMap[row.STAGE_NAME].lostCount = Number(row.DEAL_COUNT);
        }
      }
      const stageAverages = Object.entries(stageAvgMap).map(([stage, data]) => ({ stage, ...data }));
      const result = { perOpp, stageAverages };
      stageHistoryCache.set(cacheKey, { data: result, timestamp: Date.now() });
      res.json(result);
    } catch (error: any) {
      console.error('Stage history error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/csql-match-confidence', isAuthenticated, async (req: any, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'Gemini API key not configured' });
      }

      const { items } = req.body as { items: { oppId: string; oppName: string; accountName: string; assessmentId: number }[] };
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'items array is required' });
      }

      const assessmentIds = [...new Set(items.map(i => i.assessmentId))];
      const assessmentRows = await db
        .select({
          id: assessments.id,
          executiveSummary: assessments.executiveSummary,
          accountName: assessments.accountName,
        })
        .from(assessments)
        .where(inArray(assessments.id, assessmentIds));

      const assessmentMap = new Map<number, typeof assessmentRows[0]>();
      for (const a of assessmentRows) {
        assessmentMap.set(a.id, a);
      }

      const ai = new GoogleGenAI({ apiKey });
      const results: { oppId: string; confidence: string; reasoning: string }[] = [];

      const BATCH_SIZE = 10;
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        const batchItems = batch.map((item, idx) => {
          const assessment = assessmentMap.get(item.assessmentId);
          const summary = assessment?.executiveSummary || 'No summary available';
          return `Item ${idx + 1}:\n  Opportunity Name: "${item.oppName}"\n  Account: "${item.accountName}"\n  Call Summary: "${summary.substring(0, 500)}"`;
        }).join('\n\n');

        const prompt = `You are analyzing whether sales calls are correctly matched to Salesforce opportunities (CSQLs).

For each item below, determine if the call summary is relevant to the opportunity. Consider:
- Does the call discuss the same account/company?
- Does the call discuss topics related to what the opportunity is about?
- A call about general account health or unrelated topics would be a poor match.

Rate each as:
- "green": The call clearly relates to the opportunity (discusses relevant products, features, or deal topics)
- "yellow": The call may be related but is unclear (general account discussion, or partial relevance)
- "red": The call appears unrelated to the opportunity (different topic, generic check-in with no deal relevance)

${batchItems}`;

        try {
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    itemIndex: { type: Type.NUMBER },
                    confidence: { type: Type.STRING },
                    reasoning: { type: Type.STRING },
                  },
                  required: ["itemIndex", "confidence", "reasoning"],
                },
              },
            },
          });

          const parsed = JSON.parse(response.text || '[]') as { itemIndex: number; confidence: string; reasoning: string }[];
          for (const result of parsed) {
            const idx = result.itemIndex - 1;
            if (idx >= 0 && idx < batch.length) {
              const conf = result.confidence.toLowerCase();
              const validConf = ["green", "yellow", "red"].includes(conf) ? conf : "yellow";
              results.push({
                oppId: batch[idx].oppId,
                confidence: validConf,
                reasoning: result.reasoning,
              });
            }
          }
        } catch (geminiErr: any) {
          console.error('Gemini match confidence batch error:', geminiErr.message);
          for (const item of batch) {
            results.push({ oppId: item.oppId, confidence: "yellow", reasoning: "Analysis failed" });
          }
        }
      }

      for (const r of results) {
        const item = items.find(i => i.oppId === r.oppId);
        if (!item) continue;
        await db
          .insert(csqlMatchConfidence)
          .values({
            oppId: r.oppId,
            assessmentId: item.assessmentId,
            confidence: r.confidence,
            reasoning: r.reasoning,
          })
          .onConflictDoUpdate({
            target: csqlMatchConfidence.oppId,
            set: {
              confidence: r.confidence,
              reasoning: r.reasoning,
              assessmentId: item.assessmentId,
              createdAt: sql`now()`,
            },
          });
      }

      res.json({ results });
    } catch (error: any) {
      console.error('Match confidence error:', error);
      res.status(500).json({ error: error.message || 'Failed to analyze match confidence' });
    }
  });

  app.get('/api/csql-find-calls', isAuthenticated, async (req: any, res) => {
    try {
      if (!isSnowflakeConfigured()) {
        return res.status(503).json({ error: 'Snowflake integration not configured' });
      }

      const accountName = req.query.accountName as string;
      const beforeDate = req.query.beforeDate as string;

      if (!accountName || !beforeDate) {
        return res.status(400).json({ error: 'accountName and beforeDate are required' });
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(beforeDate)) {
        return res.status(400).json({ error: 'beforeDate must be in YYYY-MM-DD format' });
      }

      const calls = await getCallsForAccount(accountName, beforeDate);

      const analyzedCalls = await db.select({
          gongConversationId: assessments.gongConversationId,
          id: assessments.id,
          totalScore: assessments.totalScore,
        })
        .from(assessments)
        .where(sql`${assessments.gongConversationId} IS NOT NULL`);

      const analyzedMap = new Map(analyzedCalls.map(a => [a.gongConversationId, a]));

      const enrichedCalls = calls.map(call => {
        const analyzed = analyzedMap.get(call.CONVERSATION_ID);
        return {
          conversationId: call.CONVERSATION_ID,
          title: call.CALL_TITLE,
          callDate: call.CALL_DATE,
          callUrl: `https://app.gong.io/call?id=${call.CONVERSATION_ID}`,
          csmName: call.CSM_NAME,
          durationMins: call.DURATION_MINS,
          accountName: call.ACCOUNT_NAME,
          alreadyAnalyzed: !!analyzed,
          assessmentId: analyzed?.id || null,
          assessmentScore: analyzed?.totalScore || null,
        };
      });

      res.json({ calls: enrichedCalls });
    } catch (error) {
      console.error("Error finding calls for account:", error);
      res.status(500).json({ error: 'Failed to find calls for account' });
    }
  });

  app.post('/api/csql/override', isAuthenticated, async (req: any, res) => {
    try {
      const { oppId, assessmentId } = req.body;
      const userId = req.user?.claims?.sub;

      if (!oppId || !assessmentId || !userId) {
        console.error("Override validation failed:", { oppId: !!oppId, assessmentId: !!assessmentId, userId: !!userId });
        return res.status(400).json({ error: `Missing required fields: oppId=${!!oppId}, assessmentId=${!!assessmentId}, userId=${!!userId}` });
      }

      const numericAssessmentId = Number(assessmentId);
      const stringUserId = String(userId);
      const stringOppId = String(oppId);

      const [assessment] = await db.select({ id: assessments.id, totalScore: assessments.totalScore }).from(assessments).where(eq(assessments.id, numericAssessmentId));
      if (!assessment) {
        return res.status(404).json({ error: `Assessment ${numericAssessmentId} not found` });
      }

      await db.insert(csqlCallOverrides)
        .values({ oppId: stringOppId, assessmentId: numericAssessmentId, overriddenBy: stringUserId })
        .onConflictDoUpdate({
          target: csqlCallOverrides.oppId,
          set: { assessmentId: numericAssessmentId, overriddenBy: stringUserId, createdAt: new Date() },
        });

      res.json({ success: true, assessmentId: numericAssessmentId, totalScore: assessment.totalScore });
    } catch (error) {
      console.error("Error saving CSQL override:", error);
      const message = error instanceof Error ? error.message : 'Failed to save override';
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/csql/override/:oppId', isAuthenticated, async (req: any, res) => {
    try {
      const { oppId } = req.params;
      await db.delete(csqlCallOverrides).where(eq(csqlCallOverrides.oppId, oppId));
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing CSQL override:", error);
      res.status(500).json({ error: 'Failed to remove override' });
    }
  });

  app.post('/api/csql/set-match-confidence', isAuthenticated, async (req: any, res) => {
    try {
      const { oppId, assessmentId, confidence } = req.body;
      if (!oppId || !assessmentId || !['green', 'yellow', 'red'].includes(confidence)) {
        return res.status(400).json({ error: 'oppId, assessmentId, and confidence (green/yellow/red) are required' });
      }

      const existing = await db.select().from(csqlMatchConfidence).where(eq(csqlMatchConfidence.oppId, oppId));
      if (existing.length > 0) {
        await db.update(csqlMatchConfidence)
          .set({ confidence, reasoning: "Manually set", isManual: true })
          .where(eq(csqlMatchConfidence.oppId, oppId));
      } else {
        await db.insert(csqlMatchConfidence).values({
          oppId,
          assessmentId,
          confidence,
          reasoning: "Manually set",
          isManual: true,
        });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error setting match confidence:", error);
      res.status(500).json({ error: 'Failed to set match confidence' });
    }
  });

  app.delete('/api/csql/reset-match-confidence/:oppId', isAuthenticated, async (req: any, res) => {
    try {
      const { oppId } = req.params;
      await db.delete(csqlMatchConfidence).where(eq(csqlMatchConfidence.oppId, oppId));
      res.json({ success: true });
    } catch (error) {
      console.error("Error resetting match confidence:", error);
      res.status(500).json({ error: 'Failed to reset match confidence' });
    }
  });

  app.post('/api/csql/toggle-exclusion', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { oppId } = req.body;
      if (!oppId) return res.status(400).json({ error: 'oppId is required' });

      const existing = await db.select().from(csqlExclusions).where(eq(csqlExclusions.oppId, oppId));
      if (existing.length > 0) {
        await db.delete(csqlExclusions).where(eq(csqlExclusions.oppId, oppId));
        res.json({ success: true, isExcluded: false });
      } else {
        await db.insert(csqlExclusions).values({ oppId, excludedBy: userId });
        res.json({ success: true, isExcluded: true });
      }
    } catch (error) {
      console.error("Error toggling CSQL exclusion:", error);
      res.status(500).json({ error: 'Failed to toggle exclusion' });
    }
  });

  app.post('/api/csql/auto-score', isAuthenticated, async (req: any, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const sendEvent = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    let cancelled = false;
    req.on('close', () => { cancelled = true; });

    try {
      if (!isSnowflakeConfigured()) {
        sendEvent({ type: 'error', message: 'Snowflake integration not configured' });
        res.end();
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        sendEvent({ type: 'error', message: 'Gemini API key not configured' });
        res.end();
        return;
      }

      const userId = req.user?.claims?.sub;
      const selectedOppIds: string[] | null = Array.isArray(req.body?.oppIds) ? req.body.oppIds : null;

      sendEvent({ type: 'status', message: 'Fetching CSQLs and call data...' });

      const [csqls, accountConvMap] = await Promise.all([
        getCSQLOpportunities(),
        getAccountConversationMap(),
      ]);

      const allAssessments = await db
        .select({
          id: assessments.id,
          gongConversationId: assessments.gongConversationId,
          totalScore: assessments.totalScore,
          gongMetadata: assessments.gongMetadata,
          createdAt: assessments.createdAt,
        })
        .from(assessments)
        .where(sql`${assessments.gongConversationId} IS NOT NULL`);

      const assessmentsByConvId = new Map<string, typeof allAssessments[0]>();
      for (const a of allAssessments) {
        if (a.gongConversationId) {
          assessmentsByConvId.set(a.gongConversationId, a);
        }
      }

      const getCallDate = (a: typeof allAssessments[0], convCallDate?: string): Date | null => {
        const meta = a.gongMetadata as any;
        if (meta?.callDate) {
          const d = new Date(meta.callDate);
          if (!isNaN(d.getTime())) return d;
        }
        if (convCallDate) {
          const d = new Date(convCallDate);
          if (!isNaN(d.getTime())) return d;
        }
        if (a.createdAt) return new Date(a.createdAt);
        return null;
      };

      let targetCSQLs = selectedOppIds
        ? csqls.filter(csql => selectedOppIds.includes(csql.OPP_ID))
        : csqls;

      const unscoredCSQLs = targetCSQLs.filter(csql => {
        const oppCreatedDate = new Date(csql.CREATED_DATE);
        const windowStart = new Date(oppCreatedDate);
        windowStart.setDate(windowStart.getDate() - 90);
        const cutoff = new Date(oppCreatedDate);
        cutoff.setHours(cutoff.getHours() + 24);

        const accountConversations = accountConvMap.get(csql.ACCOUNT_ID) || [];
        for (const conv of accountConversations) {
          const assessment = assessmentsByConvId.get(conv.conversationId);
          if (!assessment) continue;
          const callDate = getCallDate(assessment, conv.callDate);
          if (callDate && callDate <= cutoff && callDate >= windowStart) {
            return false;
          }
        }
        return true;
      });

      if (unscoredCSQLs.length === 0) {
        const msg = selectedOppIds ? 'All selected CSQLs already have linked call scores' : 'All CSQLs already have linked call scores';
        sendEvent({ type: 'complete', message: msg, scored: 0, failed: 0, skipped: 0, total: 0 });
        res.end();
        return;
      }

      sendEvent({ type: 'progress', total: unscoredCSQLs.length, scored: 0, failed: 0, skipped: 0, current: '' });

      const { GoogleGenAI: GenAI, Type: GType } = await import("@google/genai");
      const ai = new GenAI({ apiKey });

      let scored = 0;
      let failed = 0;
      let skipped = 0;
      const CONCURRENCY = 4;

      const geminiResponseSchema = {
        type: GType.OBJECT,
        properties: {
          scores: {
            type: GType.ARRAY,
            items: {
              type: GType.OBJECT,
              properties: {
                categoryId: { type: GType.STRING, enum: ["discovery", "motivation", "opportunity", "validation", "execution"] },
                score: { type: GType.INTEGER },
                reasoning: { type: GType.STRING },
                gap: { type: GType.STRING },
                quotes: { type: GType.ARRAY, items: { type: GType.STRING } },
                betterQuestion: { type: GType.STRING },
                recommendation: { type: GType.STRING }
              },
              required: ["categoryId", "score", "reasoning", "gap", "quotes", "betterQuestion", "recommendation"]
            }
          },
          stakeholders: {
            type: GType.ARRAY,
            items: {
              type: GType.OBJECT,
              properties: {
                name: { type: GType.STRING },
                title: { type: GType.STRING },
                persona: { type: GType.STRING },
                sentiment: { type: GType.STRING, enum: ["Positive", "Neutral", "Skeptical", "Negative", "Unknown"] },
                influence: { type: GType.STRING, enum: ["High", "Medium", "Low"] },
                keyInterest: { type: GType.STRING },
                missingInfo: { type: GType.BOOLEAN },
                painPoints: { type: GType.ARRAY, items: { type: GType.STRING } },
                businessGoal: { type: GType.STRING },
                additionalNotes: { type: GType.STRING }
              },
              required: ["name", "title", "persona", "sentiment", "influence", "keyInterest", "missingInfo", "painPoints", "businessGoal", "additionalNotes"]
            }
          },
          executiveSummary: { type: GType.STRING },
          keyStrengths: { type: GType.ARRAY, items: { type: GType.STRING } },
          coachingTips: { type: GType.ARRAY, items: { type: GType.STRING } },
          qa: {
            type: GType.ARRAY,
            items: {
              type: GType.OBJECT,
              properties: {
                id: { type: GType.STRING },
                label: { type: GType.STRING },
                question: { type: GType.STRING },
                status: { type: GType.STRING },
                evidence: { type: GType.STRING }
              },
              required: ["id", "label", "question", "status"]
            }
          }
        },
        required: ["scores", "executiveSummary", "keyStrengths", "coachingTips", "stakeholders"]
      };

      const processOneCSQL = async (csql: typeof unscoredCSQLs[0]) => {
        if (cancelled || req.socket.destroyed) return;

        const accountName = csql.ACCOUNT_NAME;
        const csqlDate = new Date(csql.CREATED_DATE);
        const beforeDate = csql.CREATED_DATE.split('T')[0];

        sendEvent({ type: 'progress', total: unscoredCSQLs.length, scored, failed, skipped, current: accountName });

        try {
          const calls = await getCallsForAccount(accountName, beforeDate);

          if (!calls || calls.length === 0) {
            skipped++;
            sendEvent({ type: 'progress', total: unscoredCSQLs.length, scored, failed, skipped, current: `${accountName} - no calls found` });
            return;
          }

          calls.sort((a, b) => {
            const dateA = new Date(a.CALL_DATE);
            const dateB = new Date(b.CALL_DATE);
            return Math.abs(dateA.getTime() - csqlDate.getTime()) - Math.abs(dateB.getTime() - csqlDate.getTime());
          });

          const alreadyAnalyzed = await db.select({ id: assessments.id, gongConversationId: assessments.gongConversationId })
            .from(assessments)
            .where(sql`${assessments.gongConversationId} IN (${sql.join(calls.map(c => sql`${c.CONVERSATION_ID}`), sql`, `)})`);

          const analyzedSet = new Set(alreadyAnalyzed.map(a => a.gongConversationId));

          const closestAnalyzed = calls.find(c => analyzedSet.has(c.CONVERSATION_ID));
          if (closestAnalyzed) {
            const match = alreadyAnalyzed.find(a => a.gongConversationId === closestAnalyzed.CONVERSATION_ID);
            if (match) {
              scored++;
              sendEvent({ type: 'scored', accountName, conversationId: match.gongConversationId, assessmentId: match.id, total: unscoredCSQLs.length, scored, failed, skipped });
              return;
            }
          }

          let targetCall = calls.find(c => !analyzedSet.has(c.CONVERSATION_ID));

          if (!targetCall) {
            skipped++;
            return;
          }

          if (cancelled) return;

          const transcript = await getTranscriptText(targetCall.CONVERSATION_ID);

          if (cancelled) return;

          sendEvent({ type: 'progress', total: unscoredCSQLs.length, scored, failed, skipped, current: `Scoring ${accountName}...` });

          const prompt = `
            You are an expert Sales Coach. Analyze the following sales call transcript (or notes) and score it against the "MOVE" Rubric provided below.

            PART 1: MOVE RUBRIC DEFINITIONS:
            ${MOVE_RUBRIC_CONTEXT}

            TRANSCRIPT/NOTES:
            ${transcript}

            INSTRUCTIONS:

            1. MOVE SCORING: For each of the 5 categories, assign a score from 1 to 4 based strictly on the rubric criteria.
               Use these EXACT categoryId values:
               - "discovery" for Discovery Quality
               - "motivation" for Motivation
               - "opportunity" for Opportunity
               - "validation" for Validation
               - "execution" for Execution

            2. DETAILED ANALYSIS PER CATEGORY:
               - Observation: What happened? Describe the CSM's behavior concisely.
               - Evidence (CRITICAL): You MUST extract DIRECT QUOTES from the transcript to support your scoring.
               - The Gap: Specifically what was missed or done poorly that prevented a higher score?
               - Recommendation: The STRATEGIC advice.
               - Better Question: The TACTICAL script.

            3. STAKEHOLDER MAPPING: Identify key participants from the customer side.

            4. SUMMARY: Provide an executive summary, key strengths, and coaching tips.

            5. QA CHECKLIST: Evaluate the call against these binary criteria (Yes/No/NA):
               - Agenda, Decision Maker, Timeline, Competitors, Next Steps
          `;

          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: geminiResponseSchema,
            }
          });

          const text = response.text;
          if (!text) {
            failed++;
            sendEvent({ type: 'progress', total: unscoredCSQLs.length, scored, failed, skipped, current: `${accountName} - AI returned no response` });
            return;
          }

          const analysisResult = JSON.parse(text);
          const totalScore = analysisResult.scores.reduce((sum: number, s: any) => sum + s.score, 0);

          const [saved] = await db.insert(assessments).values({
            userId,
            accountName: targetCall.ACCOUNT_NAME || accountName,
            transcript,
            scores: analysisResult.scores,
            stakeholders: analysisResult.stakeholders,
            executiveSummary: analysisResult.executiveSummary,
            keyStrengths: analysisResult.keyStrengths,
            coachingTips: analysisResult.coachingTips,
            qa: analysisResult.qa,
            totalScore,
            source: "gong",
            gongConversationId: targetCall.CONVERSATION_ID,
            gongMetadata: {
              callUrl: `https://app.gong.io/call?id=${targetCall.CONVERSATION_ID}`,
              csmName: targetCall.CSM_NAME,
              callDate: targetCall.CALL_DATE,
              durationMins: targetCall.DURATION_MINS,
            },
          }).returning();

          scored++;
          sendEvent({ type: 'scored', accountName, conversationId: targetCall.CONVERSATION_ID, assessmentId: saved.id, totalScore, total: unscoredCSQLs.length, scored, failed, skipped });

        } catch (callError: any) {
          console.error(`Error auto-scoring for ${accountName}:`, callError?.message || callError);
          failed++;
          sendEvent({ type: 'progress', total: unscoredCSQLs.length, scored, failed, skipped, current: `${accountName} - error: ${callError?.message?.slice(0, 100)}` });
        }
      };

      const queue = [...unscoredCSQLs];
      const runWorker = async () => {
        while (queue.length > 0 && !cancelled && !req.socket.destroyed) {
          const csql = queue.shift();
          if (csql) await processOneCSQL(csql);
        }
      };

      const workers = Array.from({ length: Math.min(CONCURRENCY, unscoredCSQLs.length) }, () => runWorker());
      await Promise.all(workers);

      sendEvent({ type: 'complete', message: 'Auto-scoring complete', scored, failed, skipped, total: unscoredCSQLs.length });
      res.end();

    } catch (error: any) {
      console.error("Error in CSQL auto-score:", error);
      sendEvent({ type: 'error', message: error?.message || 'Auto-scoring failed' });
      res.end();
    }
  });

  app.post('/api/csql-insights', isAuthenticated, async (req: any, res) => {
    try {
      const { csqls, summary, filters } = req.body;
      if (!csqls || !Array.isArray(csqls) || csqls.length === 0) {
        return res.status(400).json({ error: "No CSQL data provided" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key not configured" });
      }

      const { GoogleGenAI: GenAI, Type: GType } = await import("@google/genai");
      const ai = new GenAI({ apiKey });

      const csqlSummaryText = [
        `Total CSQLs: ${summary.totalCSQLs}`,
        `Linked to call scores: ${summary.linkedCount}`,
        `Closed Won: ${summary.closedWonCount} ($${(summary.wonPipeline || 0).toLocaleString()})`,
        `Closed Lost: ${summary.closedLostCount}`,
        `Open: ${summary.openCount}`,
        `Total Pipeline: $${(summary.totalPipeline || 0).toLocaleString()}`,
        `Win Rate: ${summary.winRate != null ? (summary.winRate * 100).toFixed(1) + '%' : 'N/A'}`,
        `Avg Score (Won): ${summary.avgWonScore?.toFixed(1) ?? 'N/A'}`,
        `Avg Score (Lost): ${summary.avgLostScore?.toFixed(1) ?? 'N/A'}`,
        `Avg Score (All Linked): ${summary.avgLinkedScore?.toFixed(1) ?? 'N/A'}`,
      ].join('\n');

      const csqlRows = csqls.slice(0, 200).map((c: any) => ({
        account: c.accountName,
        opp: c.oppName,
        stage: c.stageName,
        status: c.closedStatus,
        amount: c.amount,
        created: c.createdDate,
        csm: c.createdByName,
        manager: c.creatorManager || 'Unknown',
        segment: c.creatorSegment || 'Unknown',
        totalScore: c.linkedAssessment?.totalScore ?? null,
        scoreBreakdown: c.linkedAssessment?.scores?.map((s: any) => `${s.categoryId}:${s.score}`).join(', ') || null,
      }));

      const filterContext = filters ? `Active filters: ${JSON.stringify(filters)}` : 'No filters applied (showing all data)';

      const prompt = `You are an expert sales analytics consultant analyzing CSM-Sourced Qualified Leads (CSQLs) data for a SaaS company. CSQLs are opportunities created by Customer Success Managers. Each CSQL may be linked to a scored sales call using the MOVE framework (Discovery, Motivation, Opportunity, Validation, Execution) where each dimension is scored 1-4 for a max total of 20.

${filterContext}

SUMMARY:
${csqlSummaryText}

CSQL DATA (${csqlRows.length} records):
${JSON.stringify(csqlRows, null, 0)}

Analyze this data and provide:

1. KEY INSIGHTS: 3-5 data-driven observations about patterns, correlations between call scores and deal outcomes, notable trends, or surprising findings. Each should reference specific numbers from the data.

2. WIN/LOSS PATTERNS: Analyze what separates won deals from lost deals across MOVE dimensions. Which dimensions most predict success? Are there score thresholds that correlate with winning?`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: GType.OBJECT,
            properties: {
              keyInsights: {
                type: GType.ARRAY,
                items: {
                  type: GType.OBJECT,
                  properties: {
                    title: { type: GType.STRING },
                    detail: { type: GType.STRING },
                  },
                  required: ["title", "detail"],
                },
              },
              winLossPatterns: {
                type: GType.OBJECT,
                properties: {
                  summary: { type: GType.STRING },
                  criticalDimensions: {
                    type: GType.ARRAY,
                    items: {
                      type: GType.OBJECT,
                      properties: {
                        dimension: { type: GType.STRING },
                        finding: { type: GType.STRING },
                      },
                      required: ["dimension", "finding"],
                    },
                  },
                  scoreThresholds: { type: GType.STRING },
                  recommendations: { type: GType.STRING },
                },
                required: ["summary", "criticalDimensions", "scoreThresholds", "recommendations"],
              },
            },
            required: ["keyInsights", "winLossPatterns"],
          },
        },
      });

      const text = response?.text;
      if (!text) {
        return res.status(500).json({ error: "No response from AI" });
      }

      const parsed = JSON.parse(text);
      res.json(parsed);

    } catch (error: any) {
      console.error("Error generating CSQL insights:", error);
      res.status(500).json({ error: error?.message || "Failed to generate insights" });
    }
  });

  app.post('/api/csql-rep-coaching', isAuthenticated, async (req: any, res) => {
    try {
      const { repName, csqls } = req.body;
      if (!repName || !csqls || !Array.isArray(csqls) || csqls.length === 0) {
        return res.status(400).json({ error: "repName and csqls array are required" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key not configured" });
      }

      const { GoogleGenAI: GenAI, Type: GType } = await import("@google/genai");
      const ai = new GenAI({ apiKey });

      const dimensions = ["discovery", "motivation", "opportunity", "validation", "execution"];

      const scoredCSQLs = csqls.filter((c: any) => c.linkedAssessment?.scores?.length > 0).slice(0, 100);

      const dimAvgs: Record<string, number | null> = {};
      for (const dim of dimensions) {
        const vals = scoredCSQLs
          .map((c: any) => c.linkedAssessment.scores.find((s: any) => s.categoryId === dim)?.score)
          .filter((v: any): v is number => v != null);
        dimAvgs[dim] = vals.length ? Math.round((vals.reduce((a: number, b: number) => a + b, 0) / vals.length) * 10) / 10 : null;
      }

      const closedCSQLs = scoredCSQLs.filter((c: any) => c.closedStatus === "Closed Won" || c.closedStatus === "Closed Lost");
      const wonCount = closedCSQLs.filter((c: any) => c.closedStatus === "Closed Won").length;
      const winRate = closedCSQLs.length > 0 ? Math.round((wonCount / closedCSQLs.length) * 100) : null;
      const totalScores = scoredCSQLs.map((c: any) => c.linkedAssessment.totalScore).filter((s: any) => s != null);
      const avgTotal = totalScores.length ? Math.round((totalScores.reduce((a: number, b: number) => a + b, 0) / totalScores.length) * 10) / 10 : null;

      const repSummary = [
        `Rep: ${repName}`,
        `Total CSQLs analyzed: ${scoredCSQLs.length}`,
        `Avg total score: ${avgTotal ?? 'N/A'} / 20`,
        `Win rate (closed deals): ${winRate != null ? winRate + '%' : 'N/A'} (${wonCount}/${closedCSQLs.length} closed)`,
        `Dimension averages (each 1-4 scale):`,
        ...dimensions.map(d => `  ${d}: ${dimAvgs[d] ?? 'N/A'}`),
      ].join('\n');

      const dealRows = scoredCSQLs.slice(0, 60).map((c: any) => ({
        account: c.accountName,
        stage: c.closedStatus || c.stageName,
        amount: c.amount,
        totalScore: c.linkedAssessment.totalScore,
        scores: c.linkedAssessment.scores?.map((s: any) => `${s.categoryId}:${s.score}`).join(', ') || '',
      }));

      const prompt = `You are an expert sales coach analyzing the performance of a Customer Success Manager named "${repName}" at a SaaS company. They source new business opportunities (CSQLs) and are evaluated using the MOVE framework on their discovery calls:

- Discovery Quality (1-4): Depth of customer understanding
- Motivation (M, 1-4): Identifying urgency and why they need to change now
- Opportunity (O, 1-4): Connecting to measurable business outcomes
- Validation (V, 1-4): Identifying decision-makers and securing internal champions
- Execution (E, 1-4): Securing firm commitments and clear next steps

PERFORMANCE SUMMARY:
${repSummary}

DEAL DATA (${dealRows.length} deals):
${JSON.stringify(dealRows, null, 0)}

Provide personalized coaching for ${repName}. For each dimension, give:
1. A rating: "Strength" (avg ≥ 3.0), "Developing" (2.0–2.9), or "Needs Work" (< 2.0)
2. A specific observation tied to their actual score and how it correlates with their win/loss pattern in the data
3. 2-3 concrete, actionable tips they can apply on their next call

Also write a brief 2-3 sentence overall coaching summary that highlights their biggest strength and their most impactful area to improve.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: GType.OBJECT,
            properties: {
              repName: { type: GType.STRING },
              overallSummary: { type: GType.STRING },
              dimensionCoaching: {
                type: GType.ARRAY,
                items: {
                  type: GType.OBJECT,
                  properties: {
                    dimension: { type: GType.STRING },
                    avgScore: { type: GType.NUMBER },
                    rating: { type: GType.STRING },
                    observation: { type: GType.STRING },
                    tips: { type: GType.ARRAY, items: { type: GType.STRING } },
                  },
                  required: ["dimension", "avgScore", "rating", "observation", "tips"],
                },
              },
            },
            required: ["repName", "overallSummary", "dimensionCoaching"],
          },
        },
      });

      const text = response?.text;
      if (!text) {
        return res.status(500).json({ error: "No response from AI" });
      }

      res.json(JSON.parse(text));
    } catch (error: any) {
      console.error("Error generating rep coaching:", error);
      res.status(500).json({ error: error?.message || "Failed to generate coaching" });
    }
  });

  app.get('/api/qualifying-filters', isAuthenticated, async (req: any, res) => {
    try {
      let filters = await db.select().from(qualifyingCallFilters).orderBy(asc(qualifyingCallFilters.sortOrder));
      if (filters.length === 0) {
        filters = await seedDefaultFilters();
        filters.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      }
      res.json(filters);
    } catch (error) {
      console.error("Error fetching qualifying filters:", error);
      res.status(500).json({ error: 'Failed to fetch qualifying filters' });
    }
  });

  app.put('/api/qualifying-filters', isAuthenticated, async (req: any, res) => {
    try {
      const updates: Array<{ key: string; enabled?: boolean; params?: any }> = req.body;
      if (!Array.isArray(updates)) {
        return res.status(400).json({ error: 'Request body must be an array of filter updates' });
      }

      const VALID_KEYS = ["status_completed", "csm_title", "min_duration", "renewal_type", "min_days_renewal", "transcript_patterns"];
      for (const update of updates) {
        if (!VALID_KEYS.includes(update.key)) continue;
        const setValues: any = { updatedAt: new Date() };
        if (update.enabled !== undefined) setValues.enabled = !!update.enabled;
        if (update.params !== undefined) {
          const sanitized = { ...update.params };
          if (sanitized.minutes !== undefined) {
            const m = parseInt(String(sanitized.minutes), 10);
            sanitized.minutes = (isNaN(m) || m < 1 || m > 10000) ? 30 : m;
          }
          if (sanitized.days !== undefined) {
            const d = parseInt(String(sanitized.days), 10);
            sanitized.days = (isNaN(d) || d < 1 || d > 10000) ? 90 : d;
          }
          if (sanitized.titlePattern !== undefined) {
            sanitized.titlePattern = String(sanitized.titlePattern).slice(0, 200);
          }
          setValues.params = sanitized;
        }
        await db.update(qualifyingCallFilters)
          .set(setValues)
          .where(eq(qualifyingCallFilters.key, update.key));
      }

      const filters = await db.select().from(qualifyingCallFilters).orderBy(asc(qualifyingCallFilters.sortOrder));
      res.json(filters);
    } catch (error) {
      console.error("Error updating qualifying filters:", error);
      res.status(500).json({ error: 'Failed to update qualifying filters' });
    }
  });

  app.post('/api/qualifying-filters', isAuthenticated, async (req: any, res) => {
    try {
      const { pattern, filterKey } = req.body;
      if (!pattern || typeof pattern !== 'string') {
        return res.status(400).json({ error: 'pattern string is required' });
      }
      const trimmedPattern = pattern.trim().slice(0, 500);
      if (!trimmedPattern) {
        return res.status(400).json({ error: 'pattern cannot be empty' });
      }

      const targetKey = filterKey || 'transcript_patterns';
      const validKeys = ['transcript_patterns', 'call_title_patterns'];
      if (!validKeys.includes(targetKey)) {
        return res.status(400).json({ error: 'Invalid filter key' });
      }

      const [targetFilter] = await db.select().from(qualifyingCallFilters)
        .where(eq(qualifyingCallFilters.key, targetKey));

      if (!targetFilter) {
        return res.status(404).json({ error: `${targetKey} filter not found` });
      }

      const currentParams = (targetFilter.params as any) || {};
      const patterns: string[] = currentParams.patterns || [];
      if (!patterns.includes(trimmedPattern)) {
        patterns.push(trimmedPattern);
      }

      await db.update(qualifyingCallFilters)
        .set({ params: { ...currentParams, patterns }, updatedAt: new Date() })
        .where(eq(qualifyingCallFilters.key, targetKey));

      const filters = await db.select().from(qualifyingCallFilters).orderBy(asc(qualifyingCallFilters.sortOrder));
      res.json(filters);
    } catch (error) {
      console.error("Error adding pattern:", error);
      res.status(500).json({ error: 'Failed to add pattern' });
    }
  });

  app.delete('/api/qualifying-filters/pattern', isAuthenticated, async (req: any, res) => {
    try {
      const { pattern, filterKey } = req.body;
      if (!pattern || typeof pattern !== 'string') {
        return res.status(400).json({ error: 'pattern string is required' });
      }

      const targetKey = filterKey || 'transcript_patterns';
      const validKeys = ['transcript_patterns', 'call_title_patterns'];
      if (!validKeys.includes(targetKey)) {
        return res.status(400).json({ error: 'Invalid filter key' });
      }

      const [targetFilter] = await db.select().from(qualifyingCallFilters)
        .where(eq(qualifyingCallFilters.key, targetKey));

      if (!targetFilter) {
        return res.status(404).json({ error: `${targetKey} filter not found` });
      }

      const currentParams = (targetFilter.params as any) || {};
      const patterns: string[] = (currentParams.patterns || []).filter((p: string) => p !== pattern);

      await db.update(qualifyingCallFilters)
        .set({ params: { ...currentParams, patterns }, updatedAt: new Date() })
        .where(eq(qualifyingCallFilters.key, targetKey));

      const filters = await db.select().from(qualifyingCallFilters).orderBy(asc(qualifyingCallFilters.sortOrder));
      res.json(filters);
    } catch (error) {
      console.error("Error removing transcript pattern:", error);
      res.status(500).json({ error: 'Failed to remove transcript pattern' });
    }
  });

  const isProduction = process.env.NODE_ENV === 'production' || process.env.REPL_DEPLOYMENT === '1';

  if (isProduction) {
    app.get('/*splat', (req, res) => {
      res.sendFile(path.join(__dirname, '..', 'index.html'));
    });
  }

  const PORT = isProduction ? 5000 : 3001;
  const HOST = isProduction ? '0.0.0.0' : '127.0.0.1';
  
  return new Promise<void>((resolve) => {
    const server = app.listen(PORT, HOST, () => {
      console.log(`Backend server running on http://${HOST}:${PORT}`);
      resolve();
    });
    
    server.on('error', (err) => {
      console.error('Server error:', err);
    });
    
    process.on('SIGTERM', () => {
      console.log('Received SIGTERM, shutting down gracefully');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });
  });
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer().catch((err) => {
  console.error('Server startup error:', err);
  process.exit(1);
});
