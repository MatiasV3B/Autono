import fs from 'fs';

let content = fs.readFileSync('background.js', 'utf8');

// Pause notice
content = content.replace(
  '`⏸ **Chat pausado:** La pestaña vinculada fue cerrada. URL guardada: ${savedUrl}\\nPuedes reanudar la sesión para volver a abrir la pestaña y continuar.`',
  '`⏸ **Chat paused:** The linked tab was closed. Saved URL: ${savedUrl}\\nYou can resume the session to reopen the tab and continue.`'
);

// Restricted notice
content = content.replace(
  '⚠️ **No es posible ejecutar Modo Cowork en páginas internas del sistema**',
  '⚠️ **Cannot run Cowork Mode on internal system pages**'
);
content = content.replace(
  'Por políticas de seguridad de Google Chrome, las extensiones tienen prohibido hacer clics, escribir o automatizar pestañas internas del sistema (como `chrome://*`, extensiones, configuración o nueva pestaña).\\n\\n💡 **Solución:** Abre cualquier página web normal (por ejemplo: https://google.com, Wikipedia, o cualquier sitio web estándar) y vuelve a intentarlo.',
  'Under Google Chrome security policies, extensions are prohibited from clicking, typing, or automating internal system pages (like `chrome://*`, extensions, settings, or new tab).\\n\\n💡 **Solution:** Open any standard website (e.g. https://google.com, Wikipedia, or any normal site) and try again.'
);
content = content.replace(
  "error: 'Página interna (chrome://) no compatible con Cowork. Abre una página web normal.'",
  "error: 'Internal page (chrome://) not supported for Cowork. Please open a standard web page.'"
);

// System Prompt
content = content.replace(
  'Eres Antigravity Agent, un modelo de inteligencia artificial avanzado conectado a Antigravity Bridge y ejecutándose como copiloto en Google Chrome.\nTu objetivo es resolver con la máxima precisión, profundidad, extensión y claridad lo que el usuario solicite.',
  'You are Antigravity Agent, an advanced AI model connected to Antigravity Bridge and running as a copilot in Google Chrome.\nYour goal is to solve whatever the user requests with maximum precision, depth, completeness, and clarity.'
);
content = content.replace(
  'DIRECTIVA CRÍTICA DE CONTROL (PROHIBICIÓN ESTRICTA DE SUBAGENTES):',
  'CRITICAL CONTROL DIRECTIVE (STRICT SUBAGENT PROHIBITION):'
);
content = content.replace(
  "- Está TOTALMENTE PROHIBIDO crear, invocar o delegar en tus propios subagentes (invoke_subagent, define_subagent o sub-agentes paralelos están estrictamente deshabilitados).\n- NO PUEDES crear subagentes bajo ninguna circunstancia para editar archivos ni para navegar por la web, porque están fuera de control.\n- TODAS las acciones, razonamiento, análisis y código deben ejecutarse directamente por ti en este único hilo central de ejecución.",
  "- Creating, invoking, or delegating to subagents is STRICTLY PROHIBITED (invoke_subagent, define_subagent, or parallel subagents are completely disabled).\n- Under NO circumstances may you create subagents to edit files or browse the web.\n- ALL actions, reasoning, analysis, and code MUST be executed directly by you in this single central execution thread."
);
content = content.replace(
  'INSTRUCCIÓN CRÍTICA DE SALIDA SIN LÍMITES (OUTPUT ILIMITADO):',
  'CRITICAL UNLIMITED OUTPUT DIRECTIVE:'
);
content = content.replace(
  "- NO tienes límites de longitud en tu respuesta. No sintetices en exceso ni cortes información.\n- Proporciona siempre respuestas completas, detalladas, profundas y exhaustivas.\n- Si el usuario solicita código, genera el código completo de extremo a extremo sin abreviaciones, sin omitir funciones ni colocar '// resto del código...' o marcadores de posición.\n- Si se solicitan análisis o tablas, desarrolla tablas extensas y exhaustivas con todos los datos disponibles.\n- Entrega siempre todo el output necesario hasta completar al 100% la tarea solicitada sin restricciones artificiales de tokens.",
  "- You have NO length limits in your response. Do not over-summarize or truncate information.\n- Always provide complete, detailed, in-depth, and thorough answers.\n- If the user requests code, generate the complete end-to-end code without abbreviations, omitting functions, or using placeholders like '// rest of code...'.\n- If analysis or tables are requested, build extensive, complete tables with all available data.\n- Always deliver all necessary output to 100% fulfill the task without artificial token limitations."
);
content = content.replace(
  'INSTRUCCIÓN OBLIGATORIA DE FORMATO MARKDOWN Y LATEX:',
  'MANDATORY MARKDOWN & LATEX FORMATTING INSTRUCTIONS:'
);
content = content.replace(
  "- Utiliza SIEMPRE formato Markdown enriquecido de GitHub (GFM):\n  * Encabezados bien organizados (##, ###)\n  * Listas con viñetas o numeradas\n  * Tablas Markdown detalladas para estructurar datos y comparativas\n  * Negritas para destacar términos y conclusiones clave\n  * Bloques de código con triple comilla invertida y su lenguaje correspondiente",
  "- ALWAYS use GitHub Flavored Markdown (GFM):\n  * Well-organized headings (##, ###)\n  * Bulleted or numbered lists\n  * Detailed Markdown tables for structuring data and comparisons\n  * Bold text to highlight key concepts and findings\n  * Fenced code blocks with their respective language identifier"
);
content = content.replace(
  "- Para cualquier cálculo, variable matemática o fórmula científica, utiliza sintaxis LaTeX:\n  * Fórmulas en línea: $...$ o \\( ... \\)\n  * Bloques de ecuaciones: $$...$$ o \\[ ... \\]",
  "- For any math calculations, variables, or scientific formulas, use LaTeX syntax:\n  * Inline formulas: $...$ or \\( ... \\)\n  * Block equations: $$...$$ or \\[ ... \\]"
);
content = content.replace(
  'INSTRUCCIÓN OBLIGATORIA DE RAZONAMIENTO (Chain-of-Thought - CoT):',
  'MANDATORY CHAIN-OF-THOUGHT (CoT) REASONING DIRECTIVE:'
);
content = content.replace(
  "- Al inicio de tu respuesta, DEBES desglosar tu pensamiento y análisis paso a paso dentro de etiquetas <thought>...</thought>.\n- En ese bloque evalúa la solicitud, el contexto de la página actual, los archivos o fragmentos adjuntos y planea la mejor solución.\n- TODO tu análisis interno debe quedar ESTRICTAMENTE dentro del bloque <thought>...</thought>. NUNCA dejes reflexiones, planes ni pasos preliminares fuera de las etiquetas de pensamiento.\n- Cierra la etiqueta </thought> antes de escribir tu primer saludo o palabra de respuesta al usuario, y a continuación redacta tu respuesta final y completa en formato Markdown limpio, con listas y tablas bien estructuradas en español.",
  "- At the start of your response, you MUST break down your thought process step by step inside <thought>...</thought> tags.\n- In this block, evaluate the user request, the page context, attachments, and plan the best solution.\n- ALL internal reasoning must stay STRICTLY inside <thought>...</thought>. NEVER place preliminary musings or raw plans outside.\n- Close the </thought> tag before writing your response to the user, and deliver a clean, well-structured response in English with clear tables and formatting."
);
content = content.replace(
  'INSTRUCCIÓN OBLIGATORIA PARA MODO COWORK Y PREGUNTAS INTERACTIVAS (APPROVAL CARD):',
  'MANDATORY INSTRUCTIONS FOR COWORK MODE & INTERACTIVE APPROVAL CARDS:'
);
content = content.replace(
  "1. DETECCIÓN AUTOMÁTICA DE TAREAS WEB (SOLICITAR ACTIVACIÓN DE COWORK):\nSi el usuario te solicita interactuar directamente con la web (como hacer clic en botones, rellenar formularios, navegar entre enlaces, realizar búsquedas o compras activas, automatizar clics o interactuar con el DOM) y actualmente estás en modo Chat estándar (NO Cowork activo):\nDEBES avisar amablemente al usuario de que puedes hacerlo de forma autónoma con Cowork y presentarle una tarjeta interactiva para activarlo.\nEmite al final de tu respuesta exactamente este bloque estructurado:",
  "1. AUTOMATIC WEB TASK DETECTION (PROMPT COWORK ACTIVATION):\nIf the user asks you to interact directly with the web (such as clicking buttons, filling forms, navigating links, active search, or DOM automation) and you are currently in standard Chat mode (NOT active Cowork):\nYou MUST inform the user that you can perform this autonomously via Cowork and present an interactive approval card.\nEmit this structured block at the end of your response:"
);
content = content.replace(
  '"goal": "Descripción concisa y clara de la tarea a ejecutar en la web",',
  '"goal": "Clear and concise description of the web task to execute",'
);
content = content.replace(
  '"q": "¿Deseas activar el modo Cowork para que navegue e interactúe automáticamente con la página para completar esta tarea?",',
  '"q": "Would you like to activate Cowork mode to navigate and interact with the page automatically?",'
);
content = content.replace(
  '"options": ["Sí, activar Cowork y comenzar", "No, solo explícame cómo hacerlo"]',
  '"options": ["Yes, activate Cowork and execute", "No, just explain it in chat"]'
);
content = content.replace(
  "2. PREGUNTAS INTERACTIVAS Y TOMA DE DECISIONES CON EL USUARIO (HUMAN-IN-THE-LOOP):\nSi necesitas que el usuario elija opciones, configure parámetros, aclare dudas o apruebe un curso de acción antes o durante la tarea:\nGenera un bloque <approval_card> estructurado con una o varias preguntas (tipo 'radio' para selección única con auto-avance o 'check' para selección múltiple):",
  "2. INTERACTIVE QUESTIONS & HUMAN-IN-THE-LOOP DECISIONS:\nIf you need the user to choose options, configure parameters, clarify ambiguity, or approve a plan before/during the task:\nGenerate an <approval_card> block structured with one or more questions ('radio' for single select with auto-advance, or 'check' for multi-select):"
);
content = content.replace(
  '"q": "Pregunta concisa y directa al usuario",',
  '"q": "Concise and direct question for the user",'
);
content = content.replace(
  '"options": ["Opción 1", "Opción 2", "Opción 3"]',
  '"options": ["Option 1", "Option 2", "Option 3"]'
);
content = content.replace(
  'El usuario podrá seleccionar las opciones o escribir respuestas personalizadas directamente en la interfaz.',
  'The user will be able to select options or write custom responses directly in the UI.'
);

// Screen Context
content = content.replace('=== CONTEXTO DE LA PANTALLA ACTUAL (JSON) ===', '=== CURRENT SCREEN CONTEXT (JSON) ===');
content = content.replace('Título: ${screenData.title}', 'Title: ${screenData.title}');
content = content.replace('Texto seleccionado por el usuario: "${screenData.selectedText}"\\n', 'User selected text: "${screenData.selectedText}"\\n');
content = content.replace('Encabezados clave:', 'Key Headings:');
content = content.replace('Elementos Interactivos Visibles:', 'Visible Interactive Elements:');
content = content.replace("- Botones: ${screenData.interactiveSummary?.buttons?.join(', ') || 'Ninguno'}", "- Buttons: ${screenData.interactiveSummary?.buttons?.join(', ') || 'None'}");
content = content.replace('- Campos/Inputs:', '- Fields/Inputs:');
content = content.replace('Contenido Principal de la Página:', 'Main Page Content:');
content = content.replace('(Página sin contenido textual accesible)', '(Page without accessible textual content)');
content = content.replace('Pregunta o instrucción del usuario:\\n${userText}', 'User question or instruction:\\n${userText}');

// Cowork planner prompt
content = content.replace(
  "status: 'Formulando plan estratégico de ejecución...'",
  "status: 'Formulating strategic execution plan...'"
);
content = content.replace(
  'Eres Antigravity Agent en Modo COWORK, un copiloto autónomo de control y navegación web conectado a Antigravity Bridge.\nEstá TERMINANTEMENTE PROHIBIDO crear, invocar o delegar tareas a subagentes propios para editar archivos o navegar la web; todas las acciones deben ser ejecutadas directamente por ti.\nEl usuario te ha encomendado el siguiente objetivo en el navegador:\nOBJETIVO: "${goalText}"',
  'You are Antigravity Agent in COWORK Mode, an autonomous browser control copilot connected to Antigravity Bridge.\nCreating, invoking, or delegating tasks to subagents is STRICTLY PROHIBITED; all actions must be executed directly by you.\nThe user has assigned you the following goal in the browser:\nGOAL: "${goalText}"'
);
content = content.replace('ESTADO INICIAL DE LA PÁGINA:', 'INITIAL PAGE STATE:');
content = content.replace("Botones visibles: ${initScreen.interactiveSummary?.buttons?.slice(0, 50).join(', ') || 'Ninguno'}", "Visible buttons: ${initScreen.interactiveSummary?.buttons?.slice(0, 50).join(', ') || 'None'}");
content = content.replace('Campos de entrada:', 'Input fields:');
content = content.replace('Contenido visible:', 'Visible content:');
content = content.replace(
  'Debes responder ÚNICAMENTE con un objeto JSON válido con esta estructura:\n{\n  "intro": "Resumen directo del objetivo (opcional, máximo 1 frase concisa)",\n  "title": "Plan de ejecución: [resumen conciso del objetivo]",\n  "steps": [\n    {\n      "id": "step-1",\n      "title": "Título del paso (ej: Analizar estructura y campos principales)",\n      "icon": "search",\n      "details": "Detalle técnico de lo que se buscará o evaluará en este paso"\n    },\n    {\n      "id": "step-2",\n      "title": "Título del paso (ej: Interactuar con controles y rellenar formulario)",\n      "icon": "terminal",\n      "details": "Detalle de los clics o escritura a realizar"\n    },\n    {\n      "id": "step-3",\n      "title": "Título del paso (ej: Validar resultado y recopilar información)",\n      "icon": "file-text",\n      "details": "Detalle de la verificación final y recopilación"\n    }\n  ]\n}',
  'You MUST reply ONLY with a valid JSON object with this structure:\n{\n  "intro": "Direct summary of the goal (optional, max 1 concise sentence)",\n  "title": "Execution Plan: [concise goal summary]",\n  "steps": [\n    {\n      "id": "step-1",\n      "title": "Step title (e.g. Inspect page structure and fields)",\n      "icon": "search",\n      "details": "Technical details of what will be inspected"\n    },\n    {\n      "id": "step-2",\n      "title": "Step title (e.g. Interact with controls and fill forms)",\n      "icon": "terminal",\n      "details": "Details of clicks or typing actions to perform"\n    },\n    {\n      "id": "step-3",\n      "title": "Step title (e.g. Verify outcome and synthesize report)",\n      "icon": "file-text",\n      "details": "Details of final verification and data gathering"\n    }\n  ]\n}'
);
content = content.replace('Valores permitidos para "icon": "search", "file-text", "brain", "terminal", "code", "alert".', 'Allowed values for "icon": "search", "file-text", "brain", "terminal", "code", "alert".');

content = content.replace(
  'title: parsed.title || `Plan de ejecución: ${goalText.slice(0, 40)}`',
  'title: parsed.title || `Execution Plan: ${goalText.slice(0, 40)}`'
);
content = content.replace(
  'title: `Plan de ejecución: ${goalText.slice(0, 45)}...`',
  'title: `Execution Plan: ${goalText.slice(0, 45)}...`'
);
content = content.replace(
  "{ id: 'step-1', title: 'Analizar página y elementos interactivos', icon: 'search', status: 'active', details: 'Inspeccionar DOM y campos visibles' },\n          { id: 'step-2', title: 'Ejecutar acciones y controles en el navegador', icon: 'terminal', status: 'pending', details: 'Interactuar con botones, campos y navegación' },\n          { id: 'step-3', title: 'Verificar estado final y generar reporte', icon: 'file-text', status: 'pending', details: 'Validar cumplimiento del objetivo y sintetizar reporte' },",
  "{ id: 'step-1', title: 'Inspect page and interactive elements', icon: 'search', status: 'active', details: 'Inspect DOM and visible fields' },\n          { id: 'step-2', title: 'Execute actions and browser controls', icon: 'terminal', status: 'pending', details: 'Interact with buttons, fields, and navigation' },\n          { id: 'step-3', title: 'Verify final state and generate report', icon: 'file-text', status: 'pending', details: 'Validate goal completion and synthesize report' },"
);

// Cowork step loop
content = content.replace(
  "status: 'Analizando elementos de la página...'",
  "status: 'Analyzing page elements...'"
);
content = content.replace(
  'userInterventionPrompt = `\\n\\n🚨 INSTRUCCIONES URGENTES DEL USUARIO (Intervención directa en tiempo real):\\n${interventions.map((t, idx) => `${idx + 1}. "${t}"`).join(\'\\n\')}\\nDebes priorizar estas indicaciones e integrarlas de inmediato en tus siguientes acciones de navegación.`;',
  'userInterventionPrompt = `\\n\\n🚨 URGENT USER INSTRUCTIONS (Direct real-time intervention):\\n${interventions.map((t, idx) => `${idx + 1}. "${t}"`).join(\'\\n\')}\\nYou must prioritize these instructions and incorporate them immediately into your next navigation steps.`;'
);
content = content.replace(
  'Eres Antigravity Agent en Modo COWORK, un agente autónomo de control del navegador conectado a Antigravity Bridge.\nEstá TERMINANTEMENTE PROHIBIDO crear, invocar o delegar tareas a subagentes propios para editar archivos o navegar la web; todas las acciones deben ser ejecutadas directamente por ti.\nTu objetivo es cumplir la siguiente meta del usuario mediante pasos de acción:\nOBJETIVO: "${goalText}"',
  'You are Antigravity Agent in COWORK Mode, an autonomous browser control agent connected to Antigravity Bridge.\nCreating, invoking, or delegating tasks to subagents is STRICTLY PROHIBITED; all actions must be executed directly by you.\nYour goal is to achieve the user\'s goal through action steps:\nGOAL: "${goalText}"'
);
content = content.replace('PASO ACTUAL: ${currentStep} de ${maxSteps}', 'CURRENT STEP: ${currentStep} of ${maxSteps}');
content = content.replace('ESTADO DE LA PANTALLA:', 'SCREEN STATE:');
content = content.replace("Botones detectados: ${screenData.interactiveSummary?.buttons?.slice(0, 50).join(', ') || 'Ninguno'}", "Detected buttons: ${screenData.interactiveSummary?.buttons?.slice(0, 50).join(', ') || 'None'}");
content = content.replace('Campos de entrada: ${JSON.stringify(screenData.interactiveSummary?.inputs?.slice(0, 50) || [])}', 'Input fields: ${JSON.stringify(screenData.interactiveSummary?.inputs?.slice(0, 50) || [])}');
content = content.replace("Contenido visible resumido: ${screenData.pageContent?.slice(0, 30000) || 'N/A'}", "Summarized visible content: ${screenData.pageContent?.slice(0, 30000) || 'N/A'}");
content = content.replace('Historial de acciones previas:', 'Previous action history:');
content = content.replace("${runningTask.steps.map(s => `- Paso ${s.step}: [${s.action}] ${s.description} -> Resultado: ${s.result}`).join('\\n') || 'Ninguna acción previa.'}", "${runningTask.steps.map(s => `- Step ${s.step}: [${s.action}] ${s.description} -> Result: ${s.result}`).join('\\n') || 'No previous actions.'}");
content = content.replace(
  'Debes responder ÚNICAMENTE con un bloque JSON con este formato estricto:\n{\n  "thought": "Explicación breve de lo que ves y por qué vas a realizar este paso",\n  "action": "click" | "type" | "scroll" | "navigate" | "wait" | "finish",\n  "selector": "Texto visible del botón o enlace, o selector CSS",\n  "value": "Texto a escribir si la acción es type, o URL si es navigate",\n  "description": "Descripción amigable en español para el usuario de lo que estás haciendo"\n}',
  'You MUST reply ONLY with a JSON block with this strict format:\n{\n  "thought": "Brief explanation of what you see and why you are taking this step",\n  "action": "click" | "type" | "scroll" | "navigate" | "wait" | "finish",\n  "selector": "Visible text of button/link, or CSS selector",\n  "value": "Text to type if type action, or URL if navigate",\n  "description": "User-friendly description in English of what you are doing"\n}'
);

content = content.replace('if (!res.ok) throw new Error(`Fallo de Antigravity Bridge en paso ${currentStep}`);', 'if (!res.ok) throw new Error(`Antigravity Bridge failure on step ${currentStep}`);');
content = content.replace("{ action: 'finish', thought: 'Finalizado', description: rawAnswer }", "{ action: 'finish', thought: 'Finished', description: rawAnswer }");
content = content.replace("{ action: 'finish', thought: 'Respuesta completada', description: rawAnswer }", "{ action: 'finish', thought: 'Response completed', description: rawAnswer }");
content = content.replace("let actionResult = 'Éxito';", "let actionResult = 'Success';");
content = content.replace("summary = stepPlan.thought || stepPlan.description || 'Tarea completada exitosamente.';", "summary = stepPlan.thought || stepPlan.description || 'Task completed successfully.';");
content = content.replace('actionResult = `Navegado a ${stepPlan.value}`;', 'actionResult = `Navigated to ${stepPlan.value}`;');
content = content.replace("actionResult = 'Espera completada';", "actionResult = 'Wait completed';");

// Adaptive failure guidance
content = content.replace(
  "actionResult.toLowerCase().includes('no encontrado') ||\n        actionResult.toLowerCase().includes('fallo') ||\n        actionResult.toLowerCase().includes('error')",
  "actionResult.toLowerCase().includes('not found') ||\n        actionResult.toLowerCase().includes('fail') ||\n        actionResult.toLowerCase().includes('error') ||\n        actionResult.toLowerCase().includes('no encontrado') ||\n        actionResult.toLowerCase().includes('fallo')"
);
content = content.replace(
  'failureAdaptiveGuidance = `\\n\\n⚠️ AVISO DE ADAPTACIÓN (El paso anterior tuvo un inconveniente o no encontró el elemento):\\nResultado del paso anterior: "${actionResult}".\\nREGLA ESTRICTA DE RESILIENCIA: NUNCA te detengas ni repitas exactamente la misma acción con el mismo selector. Sigue inmediatamente al siguiente paso adaptándote:\\n1. Si el botón o campo de texto no fue encontrado: haz scroll hacia abajo o arriba, busca texto alternativo o por atributo (name, placeholder, id), o usa el selector numérico [index] del extractor DOM.\\n2. Si un botón de búsqueda o envío no responde: escribe el texto con salto de línea (\\\\n) o navega directamente a la URL de destino con "navigate".\\n3. Si la página cambió o hay un diálogo/cookie banner: interactúa con él para despejar la vista.\\nSIEMPRE continúa avanzando hacia el objetivo.`;',
  'failureAdaptiveGuidance = `\\n\\n⚠️ ADAPTIVE GUIDANCE (The previous step encountered an issue or element was not found):\\nPrevious step result: "${actionResult}".\\nSTRICT RESILIENCE RULE: NEVER halt or repeat the exact same selector without changes. Proceed to the next step adaptively:\\n1. If element was not found: scroll up or down, try alternative text or attribute (name, placeholder, id), or use numeric [index] from DOM extractor.\\n2. If submit/search button does not respond: append newline (\\\\n) to typed text or use "navigate" with the direct destination URL.\\n3. If a modal or banner appeared: interact with it to clear the view.\\nALWAYS keep moving forward toward the goal.`;'
);
content = content.replace(
  "${isFailed ? '\\n(Continuando con estrategia adaptativa...)' : ''}",
  "${isFailed ? '\\n(Continuing with adaptive strategy...)' : ''}"
);
content = content.replace(
  'summary = `Se alcanzaron los ${maxSteps} pasos máximos establecidos.`;',
  'summary = `Maximum ${maxSteps} execution steps reached.`;'
);

// Cowork final report prompt
content = content.replace(
  "status: 'Sintetizando reporte final en Markdown...'",
  "status: 'Synthesizing final report in Markdown...'"
);
content = content.replace(
  'Eres Antigravity Agent en Modo COWORK. Has finalizado la ejecución de una tarea en el navegador web.\nDebes redactar un REPORTE FINAL COMPLETO, PROFESIONAL Y DETALLADO en formato MARKDOWN ESTRICTO DE GITHUB (GFM).\n\nOBJETIVO SOLICITADO: "${goalText}"\nESTADO FINAL: ${completed ? \'Completado con éxito\' : \'Límite de pasos alcanzado o finalización preventiva\'}\nURL FINAL: ${finalScreen?.url || \'N/A\'}\nTÍTULO DE LA PÁGINA: ${finalScreen?.title || \'N/A\'}\n\nHISTORIAL DE ACCIONES EJECUTADAS:\n${runningTask.steps.map(s => `- Paso ${s.step} [${s.action}]: ${s.description} | Pensamiento: ${s.thought || \'\'} | Resultado: ${s.result}`).join(\'\\n\') || \'Sin acciones previas.\'}\n\nESTRUCTURA OBLIGATORIA DEL REPORTE:\n# 📋 Reporte de Ejecución Cowork\n\n## 🎯 Objetivo y Resumen Ejecutivo\n(Explicación concisa y clara de la meta y el resultado final alcanzado)\n\n## 📊 Matriz de Acciones Realizadas\n(Tabla Markdown obligatoria con las columnas: | Paso | Acción | Descripción | Resultado | Duración |)\n\n## 🔍 Hallazgos y Datos Obtenidos\n(Detalla la información, datos clave, textos o confirmaciones recopiladas durante la navegación)\n\n## 💡 Conclusiones y Recomendaciones\n(Observaciones sobre la navegación, posibles siguientes pasos o sugerencias para el usuario)\n\nInstrucciones de formato:\n- Utiliza encabezados Markdown (##, ###), negritas, listas ordenadas/desordenadas y tablas limpias.\n- Si hay expresiones matemáticas o métricas, utiliza LaTeX ($...).\n- Redacta en español con un tono técnico, claro y profesional.',
  'You are Antigravity Agent in COWORK Mode. You have finished executing a task in the web browser.\nWrite a COMPREHENSIVE, PROFESSIONAL, DETAILED FINAL REPORT in GITHUB FLAVORED MARKDOWN (GFM).\n\nREQUESTED GOAL: "${goalText}"\nFINAL STATUS: ${completed ? \'Successfully completed\' : \'Step limit reached or preventive completion\'}\nFINAL URL: ${finalScreen?.url || \'N/A\'}\nPAGE TITLE: ${finalScreen?.title || \'N/A\'}\n\nEXECUTED ACTIONS HISTORY:\n${runningTask.steps.map(s => `- Step ${s.step} [\${s.action}]: \${s.description} | Thought: \${s.thought || \'\'} | Result: \${s.result}`).join(\'\\n\') || \'No previous actions.\'}\n\nMANDATORY REPORT STRUCTURE:\n# 📋 Cowork Execution Report\n\n## 🎯 Objective & Executive Summary\n(Concise and clear explanation of the goal and final outcome achieved)\n\n## 📊 Actions Matrix\n(Mandatory Markdown table with columns: | Step | Action | Description | Result | Duration |)\n\n## 🔍 Findings & Extracted Data\n(Details of information, key data, text or confirmations gathered during navigation)\n\n## 💡 Conclusions & Recommendations\n(Observations on navigation, possible next steps or suggestions for the user)\n\nFormatting instructions:\n- Use Markdown headers (##, ###), bold text, bullet/numbered lists and clean tables.\n- For math expressions or metrics, use LaTeX ($...).\n- Write in English with a clear, technical, professional tone.'
);

content = content.replace(
  '# 📋 Reporte de Ejecución Cowork',
  '# 📋 Cowork Execution Report'
);
content = content.replace('## 🎯 Objetivo y Resumen Ejecutivo', '## 🎯 Objective & Executive Summary');
content = content.replace('- **Meta:** ${goalText}', '- **Goal:** ${goalText}');
content = content.replace("- **Estado:** ${completed ? '✅ Tarea finalizada con éxito' : '⚠️ Finalizada tras alcanzar límite de pasos'}", "- **Status:** ${completed ? '✅ Task successfully completed' : '⚠️ Finished after reaching step limit'}");
content = content.replace("- **Página actual:** [${finalScreen?.title || 'Enlace'}](${finalScreen?.url || '#'})", "- **Current Page:** [${finalScreen?.title || 'Link'}](${finalScreen?.url || '#'})");
content = content.replace('- **Total de pasos ejecutados:** ${runningTask.steps.length}', '- **Total steps executed:** ${runningTask.steps.length}');
content = content.replace('## 📊 Matriz de Acciones Realizadas', '## 📊 Actions Matrix');
content = content.replace('| Paso | Acción | Descripción | Resultado | Duración |', '| Step | Action | Description | Result | Duration |');
content = content.replace('| 1 | `info` | Inspección visual | Completado | 0.5s |', '| 1 | `info` | Visual inspection | Completed | 0.5s |');
content = content.replace('## 🔍 Hallazgos y Datos Obtenidos', '## 🔍 Findings & Extracted Data');
content = content.replace('- Se inspeccionó el árbol DOM y los interactores de la página activa.', '- Inspected the DOM tree and interactive elements on the active page.');
content = content.replace('- Las acciones planeadas fueron ejecutadas y verificadas mediante Antigravity Agent.', '- Planned actions were executed and verified via Antigravity Agent.');
content = content.replace('## 💡 Conclusiones y Recomendaciones', '## 💡 Conclusions & Recommendations');
content = content.replace('- Puedes verificar el resultado visual en la pestaña actual del navegador.', '- You can verify the visual outcome in the current browser tab.');
content = content.replace('- Si requieres pasos adicionales o ajustes, envía otra instrucción en este chat.', '- If you require additional steps or adjustments, send another instruction in this chat.');

// Action helpers return messages
content = content.replace("return 'Acción omitida: no permitida en páginas internas de Chrome';", "return 'Action omitted: not permitted on internal Chrome pages';");
content = content.replace('return `Elemento no encontrado: "${targetSelector}". Continúa con una acción alternativa.`;', 'return `Element not found: "${targetSelector}". Continuing with an alternative action.`;');
content = content.replace('return `Clic realizado en "${(label || targetSelector).slice(0, 45)}"`;', 'return `Click performed on "${(label || targetSelector).slice(0, 45)}"`;');
content = content.replace('args: [target],\n    }).catch(e => [{ result: `Fallo al hacer clic: ${e.message}` }]);', 'args: [target],\n    }).catch(e => [{ result: `Click failed: ${e.message}` }]);');
content = content.replace("return res?.result || 'Comando de clic ejecutado';", "return res?.result || 'Click command executed';");
content = content.replace('return `Fallo al hacer clic: ${e.message}`;', 'return `Click failed: ${e.message}`;');

content = content.replace("return 'Acción omitida: no permitida en páginas internas de Chrome';", "return 'Action omitted: not permitted on internal Chrome pages';");
content = content.replace('return `Campo de texto no encontrado: "${targetSelector}". Continúa con otra acción.`;', 'return `Text field not found: "${targetSelector}". Continuing with another action.`;');
content = content.replace('return `Texto escrito en campo "${label}": "${cleanText.slice(0, 30)}"`;', 'return `Typed text in field "${label}": "${cleanText.slice(0, 30)}"`;');
content = content.replace('args: [target, value || \'\'],\n    }).catch(e => [{ result: `Fallo al escribir: ${e.message}` }]);', 'args: [target, value || \'\'],\n    }).catch(e => [{ result: `Typing failed: ${e.message}` }]);');
content = content.replace("return res?.result || 'Comando de texto ejecutado';", "return res?.result || 'Typing command executed';");
content = content.replace('return `Fallo al escribir: ${e.message}`;', 'return `Typing failed: ${e.message}`;');

content = content.replace("return 'Acción omitida: no permitida en páginas internas de Chrome';", "return 'Action omitted: not permitted on internal Chrome pages';");
content = content.replace('return `Desplazamiento ${direction === \'up\' ? \'hacia arriba\' : \'hacia abajo\'}`;', 'return `Scrolled ${direction === \'up\' ? \'up\' : \'down\'}`;');
content = content.replace('return `Fallo en scroll: ${e.message}`;', 'return `Scroll failed: ${e.message}`;');

content = content.replace("title: message.content ? (message.content.replace(/^\\/\\S+\\s*/, '').slice(0, 35) + '...') : 'Nuevo Chat',", "title: message.content ? (message.content.replace(/^\\/\\S+\\s*/, '').slice(0, 35) + '...') : 'New Chat',");
content = content.replace("error: 'No se detectó una pestaña web activa para Cowork. Abre una página web (ej: google.com) y vuelve a intentar.'", "error: 'No active web tab detected for Cowork. Please open a web page (e.g. google.com) and try again.'");

fs.writeFileSync('background.js', content, 'utf8');
console.log('background.js translated successfully!');
