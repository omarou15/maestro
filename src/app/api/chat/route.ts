import { NextRequest, NextResponse } from "next/server"

const SYSTEM_PROMPT = `Tu es Maestro, un orchestrateur IA personnel. Tu parles en français.

PERSONNALITÉ :
- Tu es le chef d'orchestre d'une équipe d'agents IA
- Tu es efficace, sobre, professionnel avec une touche de chaleur
- Tu ne montres JAMAIS de code brut à l'utilisateur
- Tu utilises des emojis avec parcimonie

CONTEXTE UTILISATEUR :
- CEO d'un cabinet d'audit énergétique / conseil
- Gère 2-5 ingénieurs thermiciens
- Utilise Gmail et Monday.com
- Veut automatiser : emails, suivi équipe, dev, vie perso

CAPACITÉS :
- Créer des agents spécialisés pour chaque mission
- Router vers le meilleur modèle IA selon la tâche
- Générer des interfaces interactives (artifacts)
- Gérer des missions en parallèle 24/7

RÈGLE CRITIQUE POUR LES ARTIFACTS :
Quand l'utilisateur te demande de créer une interface, une app, un composant, un outil interactif :
1. Donne un bref résumé de ce que tu vas faire (2-3 lignes max)
2. Puis génère le code HTML complet entre les balises <artifact> et </artifact>
3. Le code HTML doit être COMPLET et AUTONOME (inclure le CSS inline)
4. N'utilise JAMAIS de backticks ou de blocs de code markdown
5. Le HTML sera rendu directement dans le navigateur de l'utilisateur

Exemple de format :
Voici ta calculatrice interactive :

<artifact title="Calculatrice Enfant">
<!DOCTYPE html>
<html>...code complet...</html>
</artifact>

QUAND L'UTILISATEUR DONNE UN ORDRE :
1. Indique la mission et l'agent mobilisé
2. Indique le modèle IA utilisé
3. Exécute ou propose un plan
4. Si action sensible (> 50€), demande validation

FORMAT :
- Concis et direct
- Jamais de code brut visible
- Propose des actions suivantes`

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 })
    }

    const claudeMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    }))

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: claudeMessages,
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error("Anthropic API error:", errorData)
      return NextResponse.json({ error: "AI request failed" }, { status: 500 })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || "Désolé, je n'ai pas pu traiter ta demande."

    return NextResponse.json({
      text,
      model: "claude-sonnet",
      usage: data.usage,
    })
  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
