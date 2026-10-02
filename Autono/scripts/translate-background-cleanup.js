import fs from 'fs';

let content = fs.readFileSync('background.js', 'utf8');

// lines around 712, 739, 764
content = content.replace(
  "pageContent: url ? `(Página interna del navegador: ${url}. Por políticas de seguridad de Google Chrome, las extensiones no pueden inspeccionar el contenido del DOM en páginas internas del sistema).` : 'Modo chat directo (sin página activa vinculada).',",
  "pageContent: url ? `(Internal browser page: ${url}. Due to Google Chrome security policies, extensions cannot inspect DOM content on internal system pages).` : 'Direct chat mode (no active linked page).',"
);
content = content.replace(
  "pageContent: 'No se pudo extraer el contenido del DOM directamente.',",
  "pageContent: 'Could not extract DOM content directly.',"
);
content = content.replace(
  "pageContent: 'Página web cargada (sin acceso a elementos del DOM).',",
  "pageContent: 'Web page loaded (no access to DOM elements).',"
);

// restrictedNotice
content = content.replace(
  "Por políticas de seguridad de Google Chrome, las extensiones tienen prohibido hacer clics, escribir o automatizar pestañas internas del sistema (como `chrome://*`, extensiones, configuración o nueva pestaña).\\n\\n💡 **Solución:** Abre cualquier página web normal (por ejemplo: https://google.com, Wikipedia, o cualquier sitio web estándar) y vuelve a intentarlo.",
  "Under Google Chrome security policies, extensions are prohibited from clicking, typing, or automating internal system tabs (such as `chrome://*`, extensions, settings, or new tab).\\n\\n💡 **Solution:** Open any standard website (e.g. https://google.com, Wikipedia, or any regular site) and try again."
);

// Título -> Title in prompts
content = content.replace('Título: ${initScreen.title}', 'Title: ${initScreen.title}');
content = content.replace('Título: ${screenData.title}', 'Title: ${screenData.title}');

// warning on plan dynamic
content = content.replace(
  "console.warn('No se pudo generar plan dinámico con el modelo, usando plan base:', err);",
  "console.warn('Could not generate dynamic plan with model, using fallback plan:', err);"
);

// failureAdaptiveGuidance
content = content.replace(
  'failureAdaptiveGuidance = `\\n\\n⚠️ AVISO DE ADAPTACIÓN (El paso anterior tuvo un inconveniente o no encontró el elemento):\\nResultado del paso anterior: "${actionResult}".\\nREGLA ESTRICTA DE RESILIENCIA: NUNCA te detengas ni repitas exactamente la misma acción con el mismo selector. Sigue inmediatamente al siguiente paso adaptándote:\\n1. Si el botón o campo de texto no fue encontrado: haz scroll hacia abajo o arriba, busca texto alternativo o por atributo (name, placeholder, id), o usa el selector numérico [index] del extractor DOM.\\n2. Si un botón de búsqueda o envío no responde: escribe el texto con salto de línea (\\\\n) o navega directamente a la URL de destino con "navigate".\\n3. Si la página cambió o hay un diálogo/cookie banner: interactúa con él para despejar la vista.\\nSIEMPRE continúa avanzando hacia el objetivo.`;',
  'failureAdaptiveGuidance = `\\n\\n⚠️ ADAPTIVE RECOVERY (The previous step encountered an issue or element was not found):\\nPrevious step outcome: "${actionResult}".\\nSTRICT RESILIENCE RULE: NEVER halt or repeat the exact same selector without changes. Proceed adaptively:\\n1. If button or text field was not found: scroll up or down, try alternative text or attribute (name, placeholder, id), or use numeric [index] from DOM extractor.\\n2. If search or submit button does not respond: append newline (\\\\n) to typed text or navigate directly to the destination URL via "navigate".\\n3. If a modal or banner appeared: interact with it to clear the page.\\nALWAYS keep progressing toward the goal.`;'
);

// currentPlanStep.details
content = content.replace(
  "currentPlanStep.details = `${stepPlan.thought ? stepPlan.thought + '\\n\\n' : ''}Acción: [${stepPlan.action.toUpperCase()}] ${stepPlan.description}\\nResultado: ${actionResult}${isFailed ? '\\n(Continuing with adaptive strategy...)' : ''}`;",
  "currentPlanStep.details = `${stepPlan.thought ? stepPlan.thought + '\\n\\n' : ''}Action: [${stepPlan.action.toUpperCase()}] ${stepPlan.description}\\nResult: ${actionResult}${isFailed ? '\\n(Continuing with adaptive strategy...)' : ''}`;"
);

// reportPrompt
content = content.replace(
  'Eres Antigravity Agent en Modo COWORK. Has finalizado la ejecución de una tarea en el navegador web.\\nDebes redactar un REPORTE FINAL COMPLETO, PROFESIONAL Y DETALLADO en formato MARKDOWN ESTRICTO DE GITHUB (GFM).\\n\\nOBJETIVO SOLICITADO: "${goalText}"\\nESTADO FINAL: ${completed ? \'Completado con éxito\' : \'Límite de pasos alcanzado o finalización preventiva\'}\\nURL FINAL: ${finalScreen?.url || \'N/A\'}\\nTÍTULO DE LA PÁGINA: ${finalScreen?.title || \'N/A\'}',
  'You are Antigravity Agent in COWORK Mode. You have finished executing a task in the web browser.\\nWrite a COMPREHENSIVE, PROFESSIONAL, DETAILED FINAL REPORT in GITHUB FLAVORED MARKDOWN (GFM).\\n\\nREQUESTED GOAL: "${goalText}"\\nFINAL STATUS: ${completed ? \'Completed successfully\' : \'Step limit reached or preventive completion\'}\\nFINAL URL: ${finalScreen?.url || \'N/A\'}\\nPAGE TITLE: ${finalScreen?.title || \'N/A\'}'
);
content = content.replace(
  'HISTORIAL DE ACCIONES EJECUTADAS:\\n${runningTask.steps.map(s => `- Paso ${s.step} [${s.action}]: ${s.description} | Pensamiento: ${s.thought || \'\'} | Resultado: ${s.result}`).join(\'\\n\') || \'Sin acciones previas.\'}',
  'EXECUTED ACTIONS HISTORY:\\n${runningTask.steps.map(s => `- Step ${s.step} [\${s.action}]: \${s.description} | Thought: \${s.thought || \'\'} | Result: \${s.result}`).join(\'\\n\') || \'No previous actions.\'}'
);
content = content.replace(
  '(Explicación concisa y clara de la meta y el resultado final alcanzado)',
  '(Concise and clear explanation of the goal and final outcome achieved)'
);
content = content.replace(
  '(Detalla la información, datos clave, textos o confirmaciones recopiladas durante la navegación)',
  '(Details of information, key data, text or confirmations gathered during navigation)'
);
content = content.replace(
  '(Observaciones sobre la navegación, posibles siguientes pasos o sugerencias para el usuario)',
  '(Observations on navigation, possible next steps or suggestions for the user)'
);
content = content.replace(
  'Instrucciones de formato:\\n- Utiliza encabezados Markdown (##, ###), negritas, listas ordenadas/desordenadas y tablas limpias.\\n- Si hay expresiones matemáticas o métricas, utiliza LaTeX ($...).\\n- Redacta en español con un tono técnico, claro y profesional.',
  'Formatting instructions:\\n- Use Markdown headers (##, ###), bold text, bullet/numbered lists and clean tables.\\n- For math expressions or metrics, use LaTeX ($...).\\n- Write in English with a clear, technical, professional tone.'
);

content = content.replace(
  "console.warn('Fallo al solicitar reporte al modelo, generando reporte de respaldo:', repErr);",
  "console.warn('Failed to request report from model, generating fallback report:', repErr);"
);

content = content.replace(
  'finalReportMarkdown = `# 📋 Reporte de Ejecución Cowork\\n\\n## 🎯 Objetivo y Resumen Ejecutivo',
  'finalReportMarkdown = `# 📋 Cowork Execution Report\\n\\n## 🎯 Objective & Executive Summary'
);
content = content.replace(
  '## 📊 Matriz de Acciones Realizadas\\n| Paso | Acción | Descripción | Resultado | Duración |',
  '## 📊 Actions Matrix\\n| Step | Action | Description | Result | Duration |'
);
content = content.replace(
  "error: err.message || 'Error en ejecución de Cowork',",
  "error: err.message || 'Error executing Cowork task',"
);

fs.writeFileSync('background.js', content, 'utf8');
console.log('Final background.js cleanup complete!');
