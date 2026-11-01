/* Nexa — asistente jurídico de Asistente Judicial Pro.
   Funciona SIN INTERNET y sin inteligencia artificial externa: busca en la base jurídica local
   (knowledge/leyes, textos oficiales de InfoLeg y del Boletín Oficial de Tucumán) y explica con reglas propias.
   Nunca inventa: si no encuentra el artículo o el tema, lo dice. Mantiene el contexto de la conversación
   (la última ley y el último artículo) para entender "¿y el siguiente?", "¿qué pena tiene?", "leelo". */
const NexaJuridico = {
  leyes: {}, orden: [], docs: [], rel: {}, df: {}, avgLen: 0, listo: null,
  ctx: { ley: null, art: null, pend: null },

  /* Nombres con que se puede pedir cada norma (además de los del índice) */
  ALIAS: {
    cp: ['codigo penal', 'cod penal', 'c p', 'cp', 'penal'],
    ep: ['24660', '24 660', 'ley de ejecucion', 'ejecucion de la pena', 'ejecucion penal', 'ley penitenciaria nacional'],
    l27375: ['27375', '27 375', 'reforma de la 24660', 'reforma de la ley de ejecucion'],
    d18: ['decreto 18', 'dto 18', '18/97', '18 97', 'reglamento de disciplina para los internos', 'disciplina federal'],
    d1136: ['1136', 'decreto 1136', '1136/97', 'reglamento de comunicaciones', 'reglamento de visitas', 'comunicaciones de los internos'],
    d303: ['decreto 303', 'dto 303', '303/96', 'reglamento general de procesados', 'reglamento de procesados'],
    d140: ['decreto 140', 'dto 140', '140/2015', '140/15', 'reglamento de educacion', 'reglamentacion de educacion'],
    d1139: ['1139', 'decreto 1139', '1139/2000', 'reglamento de recompensas'],
    cppf: ['codigo procesal penal federal', 'procesal penal federal', 'cppf', 'procesal federal'],
    cppn: ['codigo procesal penal de la nacion', 'procesal penal de la nacion', 'cppn', '23984', '23 984', 'procesal penal'],
    sppt: ['9914', '9 914', 'servicio penitenciario de tucuman', 'servicio penitenciario provincial', 'ley del servicio penitenciario', 'ley organica', 'sppt', 'spt', 'regimen penitenciario'],
    r972: ['972', '972/21', '972 21', 'resolucion 972', 'res 972', 'protocolo de conflicto', 'protocolo de conflictos', 'protocolo conflicto', 'protocolo de mediacion', 'protocolo de prevencion y solucion de conflictos', 'conflictos disciplinarios'],
    rd905: ['905', 'resolucion 905', 'reglamento disciplinario', 'reglamento de disciplina', 'sumarios', 'sumario disciplinario', 'disciplina de internos'],
    est: ['23737', '23 737', 'ley de estupefacientes', 'ley de drogas', 'estupefacientes'],
    cn: ['constitucion', 'constitucion nacional', 'constitucion argentina', 'constitucion de la nacion', 'cn', 'c n'],
    d396: ['396 99', 'decreto 396', 'dto 396', 'dec 396', 'modalidades basicas', 'reglamento de modalidades basicas', 'reglamento de la progresividad', 'reglamentacion de la 24660', 'reglamento de la 24660']
  },
  /* Normas que todavía no están en la base: se responde con honestidad */
  FALTAN: [],

  norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[º°]/g, ' ').replace(/\s+/g, ' ').trim(); },
  STOP: new Set('que del los las por para con una uno unos unas como cual cuales esta este esto estos estas ese esa eso sus son ser fue era hay sobre entre desde hasta cuando donde quien quienes cuanto cuantos cuanta mas pero porque segun sin tal sea dice dicen decir ley articulo articulos art arts codigo explicame explica explicar quiero saber podes podrias decime contame habla hablame sobre tema leer lee leelo cual seria tiene tienen hace hacer'.split(' ')),
  /* Raíz simple: primeras 5 letras (salidas/salida → "salid", matare/matar → "matar") */
  raiz(w) { return w.length > 5 ? w.slice(0, 5) : w; },
  toks(s) { return this.norm(s).split(/[^a-z0-9]+/).filter(w => w.length > 2 && !this.STOP.has(w)).map(w => this.raiz(w)); },
  /* Palabras comunes → cómo aparecen en la ley */
  SINON: {
    homicidio: 'matare muerte homicidio', asesinato: 'matare homicidio', matar: 'matare', robo: 'robo apoderare fuerza violencia', robar: 'robo apoderare',
    hurto: 'hurto apoderare', estafa: 'estafa defraudare ardid', amenaza: 'amenazas amenazare', lesion: 'lesiones daño cuerpo salud', golpe: 'lesiones',
    violacion: 'abuso sexual acceso carnal', droga: 'estupefacientes', drogas: 'estupefacientes', fuga: 'evasion evadiere fuga', evasion: 'evasion evadiere',
    libertad: 'libertad', condicional: 'condicional', salidas: 'salidas transitorias', domiciliaria: 'domiciliaria detencion domiciliaria', visitas: 'visitas visita',
    trabajo: 'trabajo laboral', estudio: 'educacion estudio', educacion: 'educacion estimulo', sancion: 'sancion sanciones faltas disciplinarias', faltas: 'faltas disciplinarias',
    castigo: 'sancion', celda: 'aislamiento alojamiento', computo: 'computo pena', prescripcion: 'prescripcion prescribe', reincidente: 'reincidencia', tentativa: 'tentativa',
    juez: 'juez ejecucion', defensor: 'defensor defensa', traslado: 'traslado traslados', salud: 'asistencia medica salud', medico: 'asistencia medica',
    intima: 'intima conyugal reunion', conyugal: 'conyugal intima reunion', progresividad: 'progresividad regimen periodo fase', fases: 'fase periodo', calificacion: 'calificacion conducta concepto', conducta: 'conducta concepto calificacion'
  },

  /* Glosario para explicar en palabras simples */
  GLOSARIO: [
    ['reclusi', 'reclusión', 'pena de encierro; hoy se cumple igual que la prisión'],
    ['prision perpetua', 'prisión perpetua', 'encierro sin plazo fijo, con posibilidad de libertad condicional según la ley'],
    ['inhabilitaci', 'inhabilitación', 'prohibición de ejercer un cargo, profesión o derecho por un tiempo'],
    ['multa', 'multa', 'pena de pagar una suma de dinero'],
    ['tentativa', 'tentativa', 'cuando se empieza a cometer el delito pero no se llega a consumar'],
    ['reincidencia', 'reincidencia', 'volver a cometer un delito después de haber cumplido pena de prisión'],
    ['concurso real', 'concurso real', 'cuando una persona comete varios delitos independientes'],
    ['alevosia', 'alevosía', 'actuar sobre seguro, aprovechando que la víctima no puede defenderse'],
    ['ensanamiento', 'ensañamiento', 'aumentar a propósito el sufrimiento de la víctima'],
    ['salidas transitorias', 'salidas transitorias', 'permisos para salir de la unidad por unas horas o días, con fines familiares, de estudio o de preparación para la libertad'],
    ['libertad condicional', 'libertad condicional', 'salir antes de cumplir toda la pena, cumpliendo condiciones que fija el juez'],
    ['libertad asistida', 'libertad asistida', 'egreso anticipado poco antes del vencimiento de la pena, con supervisión'],
    ['semilibertad', 'semilibertad', 'trabajar o estudiar afuera durante el día y volver a la unidad'],
    ['periodo de prueba', 'período de prueba', 'última etapa de la progresividad, antes de la libertad'],
    ['progresividad', 'régimen progresivo', 'la pena se cumple por etapas, de menor a mayor confianza'],
    ['juez de ejecucion', 'juez de ejecución', 'juez que controla cómo se cumple la pena'],
    ['estimulo educativo', 'estímulo educativo', 'reducción de plazos por aprobar estudios dentro de la unidad'],
    ['prision domiciliaria', 'prisión domiciliaria', 'cumplir la pena en un domicilio en vez de la unidad, en los casos que fija la ley'],
    ['detencion domiciliaria', 'detención domiciliaria', 'cumplir la detención en un domicilio en vez de la unidad, en los casos que fija la ley'],
    ['sancion', 'sanción disciplinaria', 'consecuencia por una falta a las reglas de la unidad'],
    ['prescripcion', 'prescripción', 'cuando pasa el tiempo que fija la ley y ya no se puede perseguir el delito o ejecutar la pena'],
    ['condena de ejecucion condicional', 'condena condicional', 'la pena se impone pero no se cumple en prisión si la persona respeta las condiciones'],
    ['apoderare', 'apoderarse', 'quedarse con algo ajeno'],
    ['cosa mueble', 'cosa mueble', 'un objeto que se puede trasladar']
  ],
  /* Verbos de los códigos (futuro de subjuntivo) → forma de todos los días */
  VERBOS: {
    matare: 'mate', apoderare: 'se apodere de', hiriere: 'hiera', causare: 'cause', defraudare: 'defraude', amenazare: 'amenace', falsificare: 'falsifique',
    introdujere: 'introduzca', tuviere: 'tenga', ejerciere: 'ejerza', privare: 'prive', abusare: 'abuse', sustrajere: 'sustraiga', ocultare: 'oculte',
    hiciere: 'haga', diere: 'dé', obligare: 'obligue', facilitare: 'facilite', promoviere: 'promueva', vendiere: 'venda', comerciare: 'comercie',
    exigiere: 'exija', recibiere: 'reciba', aceptare: 'acepte', omitiere: 'omita', resistiere: 'resista', evadiere: 'se evada', dañare: 'dañe',
    destruyere: 'destruya', usurpare: 'usurpe', secuestrare: 'secuestre', sustrajere_: 'sustraiga', portare: 'porte', acopiare: 'acopie', adquiriere: 'adquiera',
    fabricare: 'fabrique', expusiere: 'exponga', abandonare: 'abandone', insertare: 'inserte', suprimiere: 'suprima', revelare: 'revele', impidiere: 'impida'
  },
  /* Cómo nombrarla en una frase: "del Código Penal", "de la Ley 24.660" */
  DE: { cp: 'del Código Penal', ep: 'de la Ley 24.660', cppf: 'del Código Procesal Penal Federal', cppn: 'del Código Procesal Penal de la Nación', sppt: 'de la Ley 9.914 del Servicio Penitenciario de Tucumán', rd905: 'de la Resolución 905/19 (sumarios disciplinarios)', r972: 'del Protocolo de conflictos (Resolución 972/21)', d396: 'del Decreto 396/99 (modalidades básicas de la ejecución)', est: 'de la Ley 23.737 de estupefacientes', cn: 'de la Constitución Nacional', l27375: 'de la Ley 27.375', d18: 'del Decreto 18/97 (disciplina de internos)', d1136: 'del Decreto 1136/97 (comunicaciones y visitas)', d303: 'del Decreto 303/96 (Reglamento General de Procesados)', d140: 'del Decreto 140/2015 (educación)', d1139: 'del Decreto 1139/2000 (recompensas)' },
  de(id) { return this.DE[id] || ('de ' + ((this.leyes[id] || {}).nombre || id)); },
  /* Temas frecuentes → artículos principales (verificados contra el texto) */
  TEMAS: [
    [/(protocolo|gabinete).*(conflict|mediacion)|(conflict|mediacion).*(protocolo|gabinete)|solucion de conflictos|mediacion|medidas? (restaurativ|socioeducativ|reparativ)|acogerse al protocolo/, ['r972:2', 'r972:4', 'r972:6', 'r972:9', 'r972:15', 'r972:7']],
    [/(integra|compone|conforma|forman).*gabinete|gabinete.*(integra|compone|conforma)/, ['r972:17', 'r972:16', 'r972:18']],
    [/comite.*(protocolo|conflict|mediacion)|(protocolo|conflict|mediacion).*comite/, ['r972:19', 'r972:16']],
    [/(pelea|rina|agresion|conflicto)s? (fisica )?entre internos|agresion fisica entre iguales/, ['r972:15', 'r972:2', 'r972:4']],
    [/libertad condicional/, ['cp:13', 'cp:14', 'cp:15', 'ep:28', 'd396:40']],
    [/(frecuencia|cada cuanto|cuantas).*salidas?|salidas?.*(frecuencia|cada cuanto|por mes|por bimestre)/, ['d396:28', 'ep:16']],
    [/requisitos?.*(salidas?|semilibertad)|(salidas?|semilibertad).*requisitos?|(cuando|como) (puede|accede|se pide).*(salidas?|semilibertad)/, ['ep:17', 'd396:34', 'd396:35', 'ep:56 bis']],
    [/requisitos?.*libertad asistida|libertad asistida.*requisitos?/, ['ep:54', 'ep:56 bis']],
    [/salidas? transitorias?/, ['ep:16', 'ep:17', 'ep:19', 'd396:28', 'd396:34']],
    [/semilibertad/, ['ep:23', 'ep:17', 'd396:31', 'd396:32']],
    [/(prision|detencion|arresto) domiciliaria|domiciliaria/, ['ep:32', 'cp:10', 'ep:33']],
    [/libertad asistida/, ['ep:54']],
    [/fase de socializacion/, ['d396:15', 'd396:16', 'd396:17']], [/fase de consolidacion/, ['d396:19', 'd396:20', 'd396:21']], [/fase de confianza/, ['d396:22', 'd396:23', 'd396:25']],
    [/periodo de prueba/, ['ep:15', 'd396:26', 'd396:27']],
    [/periodo de observacion/, ['ep:13', 'd396:7', 'd396:11']],
    [/periodo de tratamiento/, ['ep:14', 'd396:14', 'd396:15', 'd396:19', 'd396:22']],
    [/progresividad|regimen progresivo|periodos?|fases/, ['ep:12', 'ep:6', 'ep:14', 'd396:1', 'd396:6']],
    [/prelibertad/, ['ep:30', 'd396:75', 'd396:79']],
    [/(calificacion|calificar|escala).*(conducta|concepto)|(conducta|concepto).*(calificacion|escala|trimestral)|conducta y concepto/, ['d396:51', 'd396:49', 'd396:56', 'd396:60', 'd396:59']],
    [/reconsideracion|recurrir la calificacion|recurso.*calificacion/, ['d396:55', 'd396:54']],
    [/consejo correccional/, ['d396:93', 'd396:94', 'd396:95', 'd396:97']],
    [/servicio criminologico|organismo tecnico criminologico|historia criminologica/, ['d396:85', 'd396:86', 'd396:7']],
    [/(no (se )?(pueden|puede) (dar|otorgar|acceder)|excluid|prohibid).*(beneficio|salida|libertad)|56 bis/, ['ep:56 bis', 'cp:14']],
    [/homicidio (agravado|calificado)|femicidio/, ['cp:80']],
    [/homicidio culposo|imprudencia/, ['cp:84']],
    [/emocion violenta|preterintencional/, ['cp:81']],
    [/homicidio|matar|asesinato/, ['cp:79', 'cp:80', 'cp:81', 'cp:84']],
    [/robo (con|a mano) arma|robo agravado/, ['cp:166', 'cp:167']],
    [/robo/, ['cp:164', 'cp:166', 'cp:167']],
    [/hurto/, ['cp:162', 'cp:163']],
    [/estafa|defraud/, ['cp:172']],
    [/amenaza/, ['cp:149 bis']],
    [/lesion/, ['cp:89', 'cp:90', 'cp:91']],
    [/abuso sexual/, ['cp:119']],
    [/evasion|fuga|evadi/, ['cp:280', 'cp:281']],
    [/tentativa/, ['cp:42', 'cp:44']],
    [/reincidencia|reincidente/, ['cp:50', 'cp:14']],
    [/prescripcion de la (accion|pena)|prescribe/, ['cp:62', 'cp:65']],
    [/condena condicional|ejecucion condicional|condenacion condicional/, ['cp:26', 'cp:27']],
    [/computo|prision preventiva/, ['cp:24']],
    [/infracciones? leves?/, ['rd905:3', 'd18:16']], [/infracciones? medias?/, ['rd905:4', 'd18:17']], [/infracciones? graves?/, ['rd905:5', 'd18:18']],
    [/(sancion|castigo|falta|infraccion).*(intern|preso|detenid|disciplin)|(intern|preso|detenid).*(sancion|castigo|falta|infraccion)|sanciones disciplinarias|faltas disciplinarias|infracciones/, ['rd905:6', 'rd905:3', 'rd905:4', 'rd905:5', 'ep:87', 'ep:85']],
    [/aislamiento provisional|medidas? cautelar(es)?.*(intern|disciplin|sumario)/, ['d18:35', 'd18:36', 'd18:37']],
    [/(apela|recurr|recurso).*(sancion|sumario)|(sancion|sumario).*(apela|recurr|recurso)/, ['ep:96', 'd18:47', 'd18:49']],
    [/suspension condicional.*sancion|primera infraccion/, ['d18:24']],
    [/sanciones colectivas|dos veces por la misma|non bis in idem/, ['d18:12', 'd18:10']],
    [/descargo|derecho de defensa.*(sumario|sancion)|sumario.*defensa/, ['ep:91', 'd18:40', 'd18:44']],
    [/retrogradacion|retroceso en la progresividad|bajar de fase/, ['d18:65', 'ep:89']],
    [/recompensas?|premio|estimulos? (por|de) conducta/, ['ep:105', 'd1139:1', 'd1139:6', 'd1139:7']],
    [/procesad|prision preventiva.*(alojamiento|regimen|unidad)|presos? sin condena/, ['d303:1', 'd303:2']],
    [/ejecucion anticipada/, ['d303:35', 'd303:36']],
    [/estimulo educativo|reduccion (de plazos )?por estudi/, ['ep:140', 'd140:8']],
    [/educacion|estudi|escuela|secundario|universidad/, ['ep:133', 'ep:140', 'd140:1']],
    [/trabajo/, ['ep:106', 'ep:107']],
    [/visita (intima|conyugal)|reunion conyugal/, ['ep:167', 'd1136:52', 'd1136:59', 'd1136:60', 'd1136:65']],
    [/visitas? (de|entre) internos|internos? de (otra|distinta) unidad/, ['d1136:70', 'd1136:72', 'd1136:73']],
    [/visitas? de (menores|ninos|chicos|hijos)|menores? (de edad )?(de visita|visitantes?)/, ['d1136:28', 'd1136:29']],
    [/(abogad|defensor).*(visita|entrevista)|(visita|entrevista).*(abogad|defensor)/, ['d1136:80', 'd1136:82', 'd1136:88']],
    [/visitas? extraordinarias?|visitas? por (distancia|salud|trabajo)/, ['d1136:39', 'd1136:41', 'd1136:48', 'd1136:49']],
    [/consolidacion familiar|reunion familiar/, ['d1136:51', 'd1136:52', 'd1136:53']],
    [/(suspen|sancion|prohib).*visitante|visitante.*(suspen|sancion|deber|derecho)/, ['d1136:21', 'd1136:22', 'd1136:24', 'd1136:25']],
    [/frecuencia de (las )?visitas|cada cuanto.*visita|visitas? ordinarias?|(quien|quienes) (puede|pueden) visitar|allegados?/, ['d1136:31', 'd1136:33', 'd1136:36', 'd1136:37']],
    [/(llamad|telefon)/, ['ep:160', 'd1136:128', 'd1136:130']],
    [/correspondencia|cartas?\b/, ['ep:160', 'd1136:132', 'd1136:135']],
    [/paquetes?|encomienda|mercaderia/, ['d1136:138', 'd1136:140', 'd1136:141']],
    [/peticion(es)?|quejas?\b/, ['d1136:125', 'd1136:126']],
    [/permiso.*(enfermedad|fallecimiento|velorio|familiar)|salida (extraordinaria|excepcional)|permiso de salida/, ['ep:166', 'd1136:114', 'd1136:115']],
    [/visitas?|comunicacion(es)? con (la )?familia/, ['ep:158', 'ep:160', 'd1136:30', 'd1136:31']],
    [/funciones del servicio penitenciario|mision del servicio penitenciario/, ['sppt:1', 'sppt:2']],
    [/(tenencia|consumo).*(personal|consumo)|tenencia para consumo|consumo personal/, ['est:14', 'est:17', 'est:21']],
    [/tenencia (de|simple).*(droga|estupefaciente|marihuana|cocaina)|(droga|estupefaciente|marihuana|cocaina).*tenencia/, ['est:14', 'est:5']],
    [/(venta|vender|comercio|comercializ|trafico|narcotrafico|transport|cultiv|siembra).*(droga|estupefaciente|marihuana|cocaina)|(droga|estupefaciente|marihuana|cocaina).*(venta|vender|comercio|comercializ|trafico|transport|cultiv)|narcotrafico|narcomenudeo/, ['est:5', 'est:11', 'est:34']],
    [/estupefacientes|drogas?\b/, ['est:5', 'est:14', 'est:11']],
    [/carceles? sanas|carceles .*limpias|seguridad y no para castigo/, ['cn:18']],
    [/juicio previo|debido proceso|defensa en juicio|declarar contra si mismo|ley anterior al hecho|pena de muerte/, ['cn:18']],
    [/amparo|habeas corpus|habeas data/, ['cn:43']],
    [/tratados? (internacionales|de derechos humanos)|jerarquia constitucional|75 inc(iso)? 22/, ['cn:75']],
    [/igualdad ante la ley|son iguales ante la ley/, ['cn:16']],
    [/derechos de (todos )?los habitantes|derecho de peticionar|libertad de expresion|publicar (sus )?ideas/, ['cn:14']],
    [/acciones privadas|principio de reserva/, ['cn:19']],
    [/preambulo/, ['cn:preámbulo']]
  ],
  /* Explicaciones escritas a mano para los artículos más consultados (resumen fiel al texto; siempre se muestra el texto oficial) */
  SIMPLE: {
    'cp:13': 'Dice cuándo se puede pedir la libertad condicional: con pena perpetua, a los 35 años de condena; con pena de más de 3 años, al cumplir los dos tercios; con pena de 3 años o menos, al cumplir 1 año de reclusión u 8 meses de prisión. Además hay que haber cumplido con regularidad los reglamentos y contar con informe de la dirección del establecimiento y de peritos que pronostiquen favorablemente la reinserción. La concede el juez con condiciones: residir donde se fije, cumplir las reglas de control (no consumir alcohol ni drogas), trabajar si no tiene medios, no cometer delitos, quedar a cargo de un patronato y hacer tratamiento si los peritos lo indican.',
    'cp:14': 'Dice a quiénes no se les concede la libertad condicional: a los reincidentes y a los condenados por ciertos delitos graves, entre ellos homicidios agravados del artículo 80, delitos contra la integridad sexual, tortura o secuestro seguidos de muerte, trata de personas, financiamiento del terrorismo y los delitos de los artículos 5, 6 y 7 de la Ley 23.737.',
    'ep:16': 'Explica qué tipos de salidas transitorias hay. Por el tiempo: hasta 12 horas, hasta 24 horas o, en casos excepcionales, hasta 72 horas. Por el motivo: para afianzar los lazos familiares y sociales, para estudiar o para participar en programas de prelibertad antes del egreso. Según el nivel de confianza: acompañado por un empleado sin uniforme, a cargo de un familiar o persona responsable, o bajo palabra de honor. Siempre las supervisa un profesional del servicio social.',
    'ep:17': 'Dice qué se necesita para las salidas transitorias o la semilibertad: estar en el período de prueba un tiempo mínimo (con penas de más de 10 años, 1 año desde el ingreso a ese período; de más de 5 años, 6 meses; de menos de 5 años, desde el ingreso), no tener otra causa abierta con pedido de detención ni otra condena pendiente, tener conducta ejemplar (o la máxima posible) en el último año y conducta y concepto al menos Buena durante dos tercios de la condena cumplida, contar con informes favorables del director, del Organismo Técnico Criminológico y del Consejo Correccional, y no estar en los delitos excluidos por el artículo 56 bis. En ciertos delitos sexuales, además, se escucha a la víctima.',
    'ep:13': 'Es la primera etapa de la pena: el organismo técnico-criminológico estudia al condenado (en lo médico, psicológico y social), arma su historia criminológica con diagnóstico y pronóstico, y propone en qué fase del tratamiento y en qué establecimiento, sección o grupo ubicarlo. Empieza cuando llega el testimonio de la sentencia y tiene que expedirse en 30 días.',
    'ep:14': 'Divide el período de tratamiento en tres fases, cada una con menos restricciones: socialización, consolidación y confianza. Para pasar a consolidación pide, entre otras cosas, conducta Buena 5 y concepto Bueno 5, no tener sanciones medias o graves en el último período calificado, trabajar con regularidad y cumplir las actividades educativas y de formación indicadas.',
    'ep:15': 'El período de prueba es la etapa de autogobierno: establecimiento abierto o semiabierto, salidas transitorias y semilibertad. Para entrar hace falta que lo proponga el resultado de la observación y del tratamiento; haber cumplido la mitad de la condena (15 años en perpetuas sin la accesoria del artículo 52; con esa accesoria, 3 años después de cumplida la pena); no tener causa abierta ni otra condena pendiente; y conducta y concepto ejemplares. Lo resuelve el director y lo comunica al juez de ejecución.',
    'ep:19': 'Las salidas transitorias y la semilibertad las da el juez de ejecución, con informes del organismo técnico-criminológico y del Consejo Correccional y después de verificar los requisitos del artículo 17. El juez fija las reglas y puede suspender o revocar el beneficio si se incumplen de forma grave o reiterada. Desde la Ley 27.375 se exige que el interno vaya acompañado por un empleado o con un dispositivo electrónico, salvo que el juez lo dispense.',
    'ep:23': 'La semilibertad permite trabajar afuera sin supervisión continua, en las mismas condiciones que cualquier trabajador (con salario y seguridad social), y volver a la unidad al terminar la jornada. Hace falta tener el trabajo asegurado antes, cumplir los requisitos del artículo 17 y no estar en los delitos del artículo 56 bis.',
    'ep:56 bis': 'Enumera delitos graves cuyos condenados no pueden tener los beneficios del período de prueba (salidas transitorias y semilibertad), ni prisión discontinua o semidetención, ni libertad asistida: homicidios agravados, delitos contra la integridad sexual, privación ilegal de la libertad o secuestro extorsivo con muerte, tortura seguida de muerte, robo con homicidio o con arma de fuego, trata de personas, terrorismo y su financiamiento, narcotráfico (artículos 5, 6 y 7 de la Ley 23.737) y contrabando agravado. Para ellos rige el régimen preparatorio del artículo 56 quater.',
    'ep:56 quater': 'Para los condenados por delitos del artículo 56 bis hay un régimen preparatorio para la liberación: un año antes de terminar la condena, si respetó los reglamentos y hay informes favorables, puede acceder a él. Los primeros 3 meses son de preparación dentro de la unidad; después, 6 meses de salidas acompañadas; y los últimos 3 meses, salidas sin supervisión. Siempre de día y de hasta 12 horas.',
    'ep:87': 'Enumera las únicas sanciones posibles: amonestación; exclusión de actividades recreativas o deportivas hasta 10 días; exclusión de la actividad en común hasta 15 días; suspensión o restricción de derechos reglamentarios hasta 15 días; permanencia en su alojamiento o celda hasta 15 días seguidos o hasta 7 fines de semana; traslado a una sección más rigurosa o a otro establecimiento. Ninguna sanción puede cortar del todo la visita y la correspondencia de un familiar directo o allegado.',
    'ep:140': 'Estímulo educativo: por estudios aprobados se acortan los plazos para avanzar en la progresividad. 1 mes por ciclo lectivo anual; 2 meses por curso anual de formación profesional; 2 por la primaria; 3 por la secundaria; 3 por un terciario; 4 por la universidad; 2 por un posgrado. Se suman hasta un máximo de 20 meses.',
    'ep:166': 'Si un familiar o allegado con derecho a visita o correspondencia tiene una enfermedad o accidente grave o fallece, el interno debe ser autorizado a salir para cumplir con sus deberes morales, salvo que haya motivos serios y fundados para negarlo. En delitos contra la integridad sexual (o cuando el juez lo disponga) va con dos custodios.',
    'ep:167': 'Quien no tiene salidas transitorias para afianzar los lazos familiares puede recibir la visita íntima de su cónyuge o, si no tiene, de su pareja estable, en la forma que fijen los reglamentos (en el ámbito federal, el Decreto 1136/97).',
    'd396:27': 'Requisitos del decreto para entrar al período de prueba: no tener causa abierta ni otra condena pendiente; haber cumplido un tercio de la condena (12 años en perpetuas); conducta Muy Buena 8 y concepto Muy Bueno 7 en el último trimestre; y dictamen favorable del Consejo Correccional con resolución del director. Atención: es el texto de 1999. Desde la Ley 27.375, el artículo 15 de la Ley 24.660 pide la mitad de la condena (15 años en perpetuas) y conducta y concepto ejemplares; donde se contradicen, manda la ley.',
    'd396:28': 'Fija cada cuánto pueden ser las salidas transitorias. Para afianzar lazos familiares: si le faltan más de 2 años para pedir la libertad condicional o asistida, 2 salidas de hasta 12 horas y 1 de hasta 24 horas por bimestre; si le faltan menos de 2 años, 1 de hasta 24 horas y 1 excepcional de hasta 48 horas por mes. Para estudiar: salidas de hasta 12 horas con la frecuencia que requieran los estudios. Para el programa de prelibertad: primero 1 salida de hasta 12 horas por quincena y después las que requiera el caso.',
    'r972:2': 'Toda falta disciplinaria puede tratarse con el protocolo si lo decide el Director de la Unidad (o quien designe), según el caso y la persona, siempre que no esté en juego la seguridad del establecimiento ni la integridad física de nadie. Es indispensable que el interno lo acepte por escrito.',
    'r972:4': 'Paso a paso: el agente que conoce la falta manda lo actuado a División Judiciales; el Jefe de Judiciales se lo informa al Director, y el Director decide si interviene el Gabinete. En el acta se le explica al interno que puede acogerse al protocolo, el plazo de prueba, la audiencia de descargo y su defensa. Si no firma el acta, renuncia al protocolo y sigue el sumario común.',
    'r972:5': 'Si el interno acepta el protocolo, se comunica al juzgado a cargo y a su defensor, avisando que las actuaciones se retomarán si el protocolo cesa.',
    'r972:6': 'El período de prueba es de hasta NOVENTA (90) días desde el hecho (o desde la notificación, si no se lo pudo notificar antes). Al terminar, cumplidas las medidas restaurativas o socioeducativas, se cierran las actuaciones.',
    'r972:7': 'El cierre se hace con un acta simple firmada por el Gabinete, sin valorar hechos ni pruebas; se fecha, se notifica al interno y se eleva al juzgado. Después se archiva y no cuenta para la calificación de conducta ni de concepto.',
    'r972:9': 'Durante la prueba el interno no debe cometer nuevas faltas. El Gabinete fija las medidas restaurativas o socioeducativas (condiciones y duración). Si comete otra falta, el protocolo queda sin efecto y se retoma el sumario original, más uno nuevo por la nueva falta.',
    'r972:15': 'Una nueva falta durante la medida la revoca y se ejecuta la sanción, avisando al juzgado. Las faltas del artículo 18 que menciona (las graves del reglamento) solo pueden analizarse en tres casos: agresión física entre iguales sin elementos peligrosos; secuestro de elementos prohibidos que no sean medicamentos no autorizados, drogas, alcohol, tóxicos, explosivos ni armas; y amenazas o agresiones verbales.',
    'r972:17': 'El Gabinete lo forman dos agentes del Área Seguridad, un/a trabajador/a social, un/a psicólogo/a y un referente de las personas privadas de la libertad.',
    'd396:51': 'Escala para calificar conducta y concepto: Ejemplar, 9 y 10; Muy Buena, 7 y 8; Buena, 5 y 6; Regular, 3 y 4; Mala, 1 y 2; Pésima, 0.',
    'ep:28': 'Dice que la libertad condicional la concede el juez de ejecución a quien cumpla los requisitos del Código Penal, con informes del Organismo Técnico Criminológico, del Consejo Correccional y de la dirección del establecimiento, que deben incluir conducta, concepto y dictámenes desde el comienzo de la pena. Al concederla se exige un dispositivo electrónico de control, salvo que el juez lo dispense.',
    'ep:32': 'Dice en qué casos el juez puede disponer que la pena se cumpla en detención domiciliaria: interno enfermo que no puede tratarse en la unidad, enfermo terminal, persona con discapacidad para quien la cárcel es un trato indigno, mayor de 70 años, mujer embarazada, o madre de un niño menor de 5 años o de una persona con discapacidad a su cargo.',
    'ep:54': 'La libertad asistida permite salir 3 meses antes de que se termine la pena, si el delito no está entre los excluidos por el artículo 56 bis. La dispone el juez de ejecución a pedido del condenado, con informes del Organismo Técnico Criminológico y del Consejo Correccional, y si tiene el grado máximo de conducta posible. El juez la niega si el egreso es un grave riesgo para el condenado, la víctima o la sociedad.',
    'ep:12': 'Dice que la pena se cumple por etapas (régimen progresivo): período de observación, período de tratamiento, período de prueba y período de libertad condicional.'
  },
  /* De qué trata cada norma, para cuando se pide la norma entera («explicame el decreto 396/99») */
  RESUMEN: {
    cp: 'Es la ley que define los delitos y sus penas. El Libro Primero tiene las reglas generales: a quién se aplica, las penas, la condena condicional, la libertad condicional, la imputabilidad, la tentativa, la participación, los concursos, la reincidencia y la prescripción. El Libro Segundo describe cada delito, agrupado según lo que protege: las personas, el honor, la integridad sexual, la libertad, la propiedad, la seguridad pública, la administración pública y otros.',
    ep: 'Regula cómo se cumple la pena de prisión. Su finalidad es que el condenado comprenda y respete la ley y logre reinsertarse. Organiza el régimen progresivo por períodos (observación, tratamiento, prueba y libertad condicional), las salidas transitorias, la semilibertad, la libertad asistida y sus excepciones (artículo 56 bis), las normas de trato, la disciplina, la conducta y el concepto, las recompensas, el trabajo, la educación, la salud, las relaciones familiares y el control del juez de ejecución. Fue reformada en 2017 por la Ley 27.375.',
    d396: 'Reglamenta, para el ámbito federal, cómo funciona la progresividad de la Ley 24.660 y el programa de prelibertad. Explica cómo se avanza por los períodos de observación, tratamiento (fases de socialización, consolidación y confianza) y prueba; cómo y cada cuánto se piden las salidas transitorias, la semilibertad y la libertad condicional; cómo y cada cuánto se califican la conducta y el concepto (escala de 0 a 10); el programa de prelibertad antes del egreso; y qué hacen el Servicio Criminológico y el Consejo Correccional. Atención: es de 1999. Donde la Ley 27.375 cambió requisitos (por ejemplo, el tiempo para entrar al período de prueba), manda la ley.',
    d18: 'Reglamenta la disciplina de los internos (Capítulo IV de la Ley 24.660) en el Servicio Penitenciario Federal. Fija los principios (no hay sanción sin norma previa, no se sanciona dos veces por lo mismo, ante la duda se favorece al interno, no hay sanciones colectivas), las infracciones leves, medias y graves, las sanciones y cómo graduarlas, el procedimiento (parte, investigación, descargo, audiencia, resolución y apelación ante el juez) y cómo se cumple cada sanción.',
    d1136: 'Reglamenta las relaciones familiares y sociales de los internos (artículos 158 a 167 de la Ley 24.660): visitas ordinarias, extraordinarias, de consolidación familiar (incluida la reunión conyugal o visita íntima), entre internos, de menores, de abogados, de profesionales de la salud y religiosas; los derechos y deberes de los visitantes; las llamadas, la correspondencia, los paquetes, las peticiones y quejas, y los permisos de salida por enfermedad o fallecimiento de familiares.',
    d303: 'Es el reglamento para las personas detenidas sin condena firme en el Servicio Penitenciario Federal. Regula el ingreso, las cuestiones procesales (comunicación, incomunicación, defensa), la Ejecución Anticipada Voluntaria (para incorporarse a la progresividad antes de la condena firme), el régimen de vida en la cárcel, la asistencia médica, espiritual y social, las relaciones familiares, la educación, el trabajo y los grupos diferenciados.',
    d140: 'Reglamenta el capítulo de Educación de la Ley 24.660 (según la Ley 26.695): el derecho a la educación pública de las personas privadas de la libertad, sus deberes como estudiantes, las restricciones prohibidas, las situaciones especiales, la información al ingreso, los certificados, el estímulo educativo del artículo 140 y el control judicial.',
    d1139: 'Reglamenta las recompensas de la Ley 24.660 (Capítulo VI): qué actos se premian (buena conducta, espíritu de trabajo, voluntad de aprender y responsabilidad, en forma conjunta), cómo los evalúa el Consejo Correccional, qué recompensas puede dar el Director y cómo se proponen al juez salidas para afianzar los lazos familiares.',
    est: 'Es la ley de estupefacientes. Castiga la siembra, producción, comercio, transporte y suministro de estupefacientes (artículo 5), su ingreso al país (artículo 6) y la organización o financiamiento de esas actividades (artículo 7); la tenencia, con pena menor si es claramente para uso personal (artículo 14); prevé agravantes (artículo 11) y medidas de seguridad curativas y educativas para quienes dependen de las drogas (artículos 16 a 22).',
    cn: 'Es la ley fundamental del país. La Primera Parte reconoce declaraciones, derechos y garantías (por ejemplo, el juicio previo y las cárceles sanas y limpias del artículo 18, y el amparo y el hábeas corpus del artículo 43). La Segunda Parte organiza las autoridades: Poder Legislativo, Poder Ejecutivo, Poder Judicial, Ministerio Público y los gobiernos de provincia. El artículo 75, inciso 22, da jerarquía constitucional a los tratados de derechos humanos.',
    cppf: 'Regula cómo se tramita un proceso penal en la justicia federal con el sistema acusatorio: principios y garantías, la acción penal, los jueces y las partes, los actos procesales, la prueba, las medidas de coerción (como la prisión preventiva), el procedimiento ordinario y los especiales, el control de las decisiones (recursos) y la ejecución.',
    cppn: 'Es el Código Procesal Penal anterior (Ley 23.984), que sigue aplicándose donde todavía no rige el nuevo código federal. Regula las acciones, el juez, las partes y la defensa, los actos procesales, la instrucción, el juicio, los recursos y la ejecución de la pena.',
    sppt: 'Es el régimen del Servicio Penitenciario de Tucumán (Ley 9.914): su misión y funciones, su estructura orgánica, los complejos y unidades penitenciarias y el régimen del personal penitenciario (ingreso, grados, ascensos, deberes, derechos y licencias, entre otros temas).',
    rd905: 'Es el reglamento de sumarios disciplinarios de los internos provinciales del Servicio Penitenciario de Tucumán (Resolución 905/19): las infracciones leves, medias y graves, las sanciones y cómo graduarlas, y el procedimiento del sumario (medidas cautelares, investigación, notificación, apelación) con sus plazos y garantías.',
    r972: 'Es el protocolo del Servicio Penitenciario de Tucumán (Resolución 972/21) para resolver faltas disciplinarias leves y medias —y algunas graves— por diálogo y mediación en vez del sumario común. Si el Director lo habilita y el interno lo acepta por escrito, el sumario se suspende durante un período de prueba de hasta 90 días con medidas restaurativas o socioeducativas que fija el Gabinete; si no comete nuevas faltas, se cierra con un acta, se archiva y no cuenta para la conducta. Intervienen el Gabinete (órgano ejecutivo) y el Comité (órgano institucional).'
  },
  /* Panorama de una norma: de qué trata, cómo está organizada (con los artículos de cada parte) y sus artículos clave */
  panorama(L) {
    const etq = s => s.replace(/:\s*(?=—|$)/, '').replace(/\s+/g, ' ').trim();
    const grupos = (arts, nivel) => {
      const out = [];
      for (const a of arts) {
        const t = etq((a.u || '').split(' › ')[nivel] || '');
        const g = out[out.length - 1];
        if (g && g.t === t) { g.hasta = a.n; g.arts.push(a); } else out.push({ t, desde: a.n, hasta: a.n, arts: [a] });
      }
      return out;
    };
    let est = grupos(L.articulos, 0).filter(g => g.t || g.arts.length > 1);
    // con pocas partes grandes (el Código Penal tiene dos libros) se muestra también el nivel siguiente
    for (const g of est) {
      const sub = grupos(g.arts, 1).filter(x => x.t);
      g.sub = sub.length > 1 && sub.length <= 30 ? sub.map(({ t, desde, hasta }) => ({ t, desde, hasta })) : [];
    }
    est = est.map(({ t, desde, hasta, sub }) => ({ t: t || 'Disposiciones iniciales', desde, hasta, sub }));
    // artículos clave: los que más usan los temas frecuentes y las explicaciones escritas a mano
    const peso = {};
    for (const [, keys] of this.TEMAS) keys.forEach((k, i) => { if (k.startsWith(L.id + ':')) peso[k] = (peso[k] || 0) + 3 - Math.min(i, 2); });
    for (const k in this.SIMPLE) if (k.startsWith(L.id + ':')) peso[k] = (peso[k] || 0) + 2;
    const clave = Object.keys(peso).sort((a, b) => peso[b] - peso[a]).slice(0, 8).map(k => k.split(':')[1])
      .map(n => this.articulo(L.id, n)).filter(Boolean).map(x => ({ n: x.a.n, t: x.a.t.slice(0, 90) }));
    const resumen = this.RESUMEN[L.id] || `${L.nombre} (${L.norma}).`;
    this.ctx = { ley: L.id, art: null, pend: null };
    const primero = L.articulos[0] && L.articulos[0].n;
    return {
      tipo: 'norma', titulo: L.nombre, norma: L.norma, fuente: L.fuente || '', descargado: L.descargado || '', origen: L.origen || '',
      resumen, estructura: est, clave, total: L.articulos.length, ley: L.id,
      texto: resumen,
      decir: `${L.nombre}. ${resumen} Tiene ${L.articulos.length} artículos${est.length > 1 ? ', organizados en ' + est.length + ' partes' : ''}. Pedime cualquier parte o artículo y te lo leo.`,
      sugerencias: [primero ? `Artículo ${primero} ${this.de(L.id)}` : '', clave[0] ? `Artículo ${clave[0].n} ${this.de(L.id)}` : ''].filter(Boolean)
    };
  },
  /* Saca de la pregunta los nombres de las normas indicadas («decreto 396/99», «ley 24.660») y los números de norma («396/99») */
  sinNormas(qn, ids) {
    let r = ' ' + qn + ' ';
    const alias = ids.flatMap(id => this.leyes[id].alias).sort((x, y) => y.length - x.length);
    for (const a of alias) r = r.replace(new RegExp('(^|[^a-z0-9])' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[ .]?') + '(?=$|[^a-z0-9])', 'g'), ' ');
    return r.replace(/\b\d+\s?\/\s?\d+\b/g, ' ').replace(/\s+/g, ' ').trim();
  },
  /* Palabras de pedido que no son un tema («necesito que me expliques», «consulta sobre», «decreto reglamentario») */
  PEDIDO: new Set('explica explicame explicamelo explicarme explicar expliques explicas explicacion explicaciones consulta consultar consulto consultas necesito necesitaria quiero queria quisiera saber conocer informacion info datos detalle detalles hablame hablar habla contame contar cuentame decime dime dame mostrame muestra resumen resumi resumime resumir resumido resumida ayuda ayudame acerca establece establecen regula trata tratan significa sirve consiste completo completa entero entera general todo toda todos todas ley leyes decreto decretos reglamentario reglamentaria reglamento reglamentos reglamentacion norma normas numero nro dto dec res resolucion codigo podrias podes puedes favor gracias hola nexa anexo texto actualizado vigente nacional federal panorama estructura indice organizado organizada armado armada principal principales basico basicos importante importantes'.split(' ')),
  terminosDe(ley) {
    this._term = this._term || {};
    if (!this._term[ley]) { const t = new Set(); for (const d of this.docs) if (d.ley === ley) for (const k in d.tf) t.add(k); this._term[ley] = t; }
    return this._term[ley];
  },
  /* ¿Pide la norma entera? Sí, si fuera del nombre de la norma no queda ningún tema que la norma trate */
  pideNorma(qn, ley) {
    if (!ley) return false;
    const resto = this.sinNormas(qn, this.orden).replace(/\b(19|20)\d\d\b/g, ' ');
    const palabras = resto.split(/[^a-z0-9ñ]+/).filter(w => w.length > 2 && !this.STOP.has(w) && !this.PEDIDO.has(w) && !/^(expli|resum|habl|cont[ae]m)/.test(w));
    const terminos = this.terminosDe(ley);
    return !palabras.some(w => terminos.has(this.raiz(w)));
  },
  /* Dentro de un tema, si la pregunta pide algo puntual («quién decide», «dónde», «cuánto dura»), va primero el artículo
     de la misma sección que mejor lo responde; los artículos principales del tema siguen como «También» */
  afinarTema(q, xs, fuera = () => false) {
    const L = xs[0].L, secciones = new Set(xs.filter(x => x.L === L).map(x => x.a.u || ''));
    const cand = new Map(this.buscar(q, L.id, 400).filter(x => secciones.has(x.d.a.u || '')).map(x => [x.d.a.n, x]));
    const sc = x => (cand.get(x.a.n) || { s: 0 }).s;
    let lista = xs.filter(x => !fuera(`${x.L.id}:${x.a.n}`));
    const mejor = [...cand.values()].filter(x => !fuera(`${L.id}:${x.d.a.n}`)).sort((a, b) => b.s - a.s)[0];
    const extra = this.toks(q).length >= 5;
    if (mejor && extra && mejor.s > sc(lista[0] || xs[0]) * 1.25 + 0.5 && (!lista[0] || mejor.d.a.n !== lista[0].a.n)) {
      lista = [{ L, a: mejor.d.a, i: mejor.d.i }, ...lista.filter(x => !(x.L === L && x.a.n === mejor.d.a.n))];
    }
    return lista.slice(0, 6);
  },
  /* Aspectos que se suelen preguntar de un tema: qué se pregunta (en la consulta) y cómo aparece en la norma */
  ASPECTOS: [
    ['Quién decide', /\b(quien|quienes)\b.*\b(decide|decidir|autoriza|resuelve|otorga|concede|aprueba|dispone|define|decir|firma)\b|quien (lo |la )?(autoriza|decide|da)|\bautoriza/, /director|juez|consejo correccional|autoriz|resoluci[oó]n|resolver[aá]|dispon|conced|otorg|aprob/gi,
      /(?:corresponder[aá]|corresponde|compete|competer[aá]) al? (?:juez|director|consejo)|(?:juez|director|consejo correccional)[^.;]{0,90}?(?:podr[aá]n? |deber[aá]n? |)(?:disponer|autorizar|conceder|otorgar|resolver|decidir|aprobar|dispondr|autorizar[aá]|conceder[aá]|otorgar[aá]|resolver[aá])/i],
    ['Dónde', /\b(donde|lugar|sala|sector|en que (lugar|unidad|establecimiento))\b|se lleva a cabo|se hace/, /(?<!(?:tener|tendr[aá]|tenga) )\blugar(?:es)?\b|\blocal(?:es)?\b|\bsalas?\b|\bsector(?:es)?\b|instalaci|traslad|alojamiento|locutorio/gi],
    ['Cada cuánto y cuánto dura', /\b(tiempo|duran?|duracion|cuantas horas|cada cuanto|frecuencia|horario|cuantas veces|cuanto tiempo)\b/, /\bhoras?\b|duraci[oó]n|frecuencia|\bcada\b|\bvez\b|\bveces\b|\bd[ií]as?\b|\bsemana|\bmes(?:es)?\b|quincen|mensual|anual/gi],
    ['Seguridad y controles', /\b(seguridad|control|controles|requisa|registro|custodia|vigilancia|revisa|revisan)\b/, /seguridad|registro (?:del|de los|de sus|personal)|registrad[oa]s? (?:el|la|los|sus)|requisa|custodi|vigil|supervisi/gi],
    ['Requisitos', /\b(requisitos?|que (se )?necesita|condiciones|quien(es)? (puede|pueden)|pueden acceder|para acceder)\b/, /requis|requier|deber[aá]n|conducta|comportamiento|condici[oó]n|acredit|sanciones|informe/gi,
      /se requiere|se requerir[aá]|son requisitos|requisitos (?:necesarios|para|que)|deber[aá]n? reunir|para (?:acceder|la concesi[oó]n|ser incorporad)|en condiciones (?:legales|de)/i],
    ['Cómo se pide', /\b(como (se )?(pide|solicita|tramita|hace el pedido)|tramite|pedido|solicitud|pedirla|pedirlo)\b/, /pedido|solicit|por escrito|expediente|tr[aá]mite/gi]
  ],
  /* Las palabras con que se preguntó el aspecto («seguridad», «autoriza»), ya en raíz */
  literales(qn, a) { return this.toks((qn.match(new RegExp(a[1].source, 'g')) || []).join(' ')); },
  aspectos(qn) {
    // la forma «quién decide» de cada aspecto (el que decide al lado del verbo) pesa más
    if (!this._fuerte) this._fuerte = new Map(this.ASPECTOS.filter(a => a[3]).map(a => [a[2], a[3]]));
    return this.ASPECTOS.filter(([, re]) => re.test(qn));
  },
  /* La parte del artículo que responde el aspecto (el inciso o la oración con más coincidencias) */
  fraseDe(t, re) {
    const partes = String(t).split(/\n+|(?<=[.;])\s+(?=[A-ZÁÉÍÓÚ(a-z]\))|(?<=\.)\s+/).map(x => x.trim()).filter(x => x.length > 15);
    let mejor = '', pm = 0;
    for (const x of partes) { const k = (x.match(re) || []).length; if (k > pm) { pm = k; mejor = x; } }
    return mejor.length > 320 ? mejor.slice(0, 317) + '…' : mejor;
  },
  /* Artículos candidatos para responder un aspecto: los de las secciones del tema que de verdad tratan lo preguntado
     (relevancia de la pregunta sin las palabras del aspecto: «visita entre internos», «visita íntima») */
  candidatos(qn, asp, xs, fuera = () => false) {
    let tema = qn;
    for (const [, re] of asp) tema = tema.replace(new RegExp(re.source, 'g'), ' ');
    const secs = new Set(xs.map(x => `${x.L.id}|${x.a.u || ''}`));
    const rel = new Map(this.buscar(tema, null, 2500).filter(x => secs.has(`${x.d.ley}|${x.d.a.u || ''}`)).map(x => [`${x.d.ley}:${x.d.a.n}`, x.s]));
    const max = Math.max(1e-9, ...rel.values());
    const out = new Map();
    for (const [k, sc] of rel) {
      if (fuera(k) || sc / max < 0.25) continue;
      const [id, n] = [k.slice(0, k.indexOf(':')), k.slice(k.indexOf(':') + 1)], x = this.articulo(id, n);
      if (!x) continue;
      out.set(k, { ...x, rel: sc / max });
      // los artículos que siguen en la misma sección suelen continuar el tema («La frecuencia de esta visita…»)
      for (const d of [1, 2]) {
        const sig = x.L.articulos[x.i + d];
        if (!sig || (sig.u || '') !== (x.a.u || '')) break;
        const ks = `${x.L.id}:${sig.n}`;
        if (!fuera(ks) && !out.has(ks)) out.set(ks, { L: x.L, a: sig, i: x.i + d, rel: (sc / max) * 0.7 });
      }
    }
    for (const x of xs) { const k = `${x.L.id}:${x.a.n}`; if (!fuera(k) && !out.has(k)) out.set(k, { ...x, rel: 0.5 }); }
    // primero la norma principal del tema y, dentro de cada norma, en orden de artículos
    const prin = xs[0].L;
    return [...out.values()].sort((a, b) => (a.L === prin ? 0 : 1) - (b.L === prin ? 0 : 1) || (a.L === b.L ? a.i - b.i : 0));
  },
  /* El artículo y la parte exacta que mejor responden un aspecto: palabras distintas del aspecto en un inciso u oración,
     más la relevancia del artículo para el tema; ante empate, el primero */
  mejorPara(re, cands, otros = [], lit = []) {
    let mejor = null, pm = 0;
    const hits = (t, r) => new Set((t.match(new RegExp(r.source, 'gi')) || []).map(m => this.norm(m).slice(0, 6))).size;
    for (const x of cands) {
      // cada oración o inciso por separado (así se cita la parte exacta)
      const bloques = String(x.a.t).split(/\n+/).map(t => t.trim()).filter(Boolean).flatMap(l => l.split(/(?<=\.)\s+(?=[A-ZÁÉÍÓÚ])/)).map(t => ({ t, cita: t }));
      for (const { t, cita } of bloques.filter(b => b.t.length > 15)) {
        const k = hits(t, re);
        if (!k) continue;
        const veces = (t.match(new RegExp(re.source, 'gi')) || []).length;
        const fuerte = otros.length >= 0 && this._fuerte && this._fuerte.get(re);
        // la misma palabra que usó quien pregunta («seguridad», «autoriza») suma
        const tt = lit.length ? new Set(this.toks(t)) : null;
        const sc = k + (fuerte && fuerte.test(t) ? 2 : 0) + (lit.length ? Math.min(1, 0.5 * lit.filter(w => tt.has(w)).length) : 0) + Math.min(0.5, 0.15 * (veces - k)) + 0.5 * otros.filter(r => r !== re && hits(t, r)).length + 0.1 * x.rel + (x.L === cands[0].L ? 0.3 : 0);
        // ante un empate (o casi), queda el primero: el artículo general antes que el de un caso particular
        if (sc > pm + 0.15) { pm = sc; mejor = { x, sc, frase: cita.length > 420 ? cita.slice(0, 417) + '…' : cita }; }
      }
    }
    // si la parte citada abre una lista («…los requisitos que se enumeran:»), se agrega la lista
    if (mejor && /:\s*$/.test(mejor.frase)) {
      const lin = String(mejor.x.a.t).split(/\n+/).map(t => t.trim());
      const j = lin.findIndex(l => l.endsWith(mejor.frase) || l === mejor.frase);
      if (j >= 0) {
        const items = [];
        for (let k = j + 1; k < lin.length && /^([a-zñ]{1,2}|\d{1,2}|[IVX]{1,4})\s*[).º°]/.test(lin[k]); k++) items.push(lin[k]);
        let f = [mejor.frase, ...items].join('\n');
        if (f.length > 700) f = f.slice(0, 697) + '…';
        mejor.frase = f;
      }
    }
    return mejor;
  },
  /* Varias preguntas sobre un mismo tema («quién decide, dónde y cuánto dura la visita entre internos»): se contesta cada
     una con el artículo que la responde, citando la parte exacta */
  respuestaAspectos(q, qn, asp, xs, fuera) {
    const cands = this.candidatos(qn, asp, xs, fuera);
    if (!cands.length) return null;
    const todos = asp.map(a => a[2]);
    const puntos = asp.map(([nombre, , re]) => {
      const m = this.mejorPara(re, cands, todos, this.literales(qn, asp.find(a => a[2] === re)));
      return m ? { asp: nombre, ley: m.x.L.id, n: m.x.a.n, abrev: m.x.L.abrev || m.x.L.nombre, frase: m.frase }
        : { asp: nombre, ley: null, n: null, frase: 'Las normas que tengo no dicen nada específico sobre esto para este tema.' };
    });
    const conArt = puntos.filter(p => p.n);
    if (!conArt.length) return null;
    const L = this.leyes[conArt[0].ley], u = (this.articulo(L.id, conArt[0].n).a.u || '');
    const tema = u ? u.split(' › ').pop() : 'el tema';
    this.ctx = { ley: L.id, art: conArt[0].n, pend: null };
    const ref = p => p.n ? ` (art. ${p.n}${p.ley !== L.id ? ' ' + p.abrev : ''})` : '';
    const texto = puntos.map(p => `• ${p.asp}: ${p.frase}${ref(p)}`).join('\n');
    return {
      tipo: 'tema', clave: `tema:${L.id}:${u}`, titulo: `${tema} — ${L.nombre}`, norma: L.norma, ley: L.id, puntos,
      fuente: L.fuente || '', descargado: L.descargado || '', origen: L.origen || '',
      otros: xs.slice(0, 5).map(x => ({ ley: x.L.id, n: x.a.n, nombre: x.L.abrev || x.L.nombre, t: x.a.t.slice(0, 140) })),
      texto, decir: `Sobre ${tema.toLowerCase()}: ` + puntos.map(p => `${p.asp}: ${this.aNumeros(p.frase)}${p.n ? ', artículo ' + p.n : ''}`).join('. ') + '.',
      sugerencias: [...new Set(conArt.map(p => `Artículo ${p.n} ${this.de(p.ley)}`))].slice(0, 3)
    };
  },
  /* «¿Qué cambió la Ley 27.375?»: se arma con las notas de InfoLeg del texto de la Ley 24.660 */
  reforma27375() {
    const de = re => this.leyes.ep.articulos.filter(a => re.test(a.t)).map(a => a.n);
    const sust = de(/sustituid[oa] por art[^)]*27\.375/i), inc = de(/incorporad[oa] por art[^)]*27\.375/i);
    this.ctx = { ley: 'l27375', art: null, pend: null };
    return this.txt(`La Ley 27.375 (Boletín Oficial del 28/07/2017) reformó la Ley 24.660.\n• Cambió ${sust.length} artículos: ${sust.join(', ')}.\n• Incorporó ${inc.length}: ${inc.join(', ')}.\n• También cambió el artículo 14 del Código Penal (a quiénes no se les da la libertad condicional) y creó el Registro Nacional de Beneficios u otras Medidas Procesales (RENABEM).\nLo que más se consulta: el artículo 56 bis (para ciertos delitos graves no hay beneficios del período de prueba —salidas transitorias y semilibertad—, ni prisión discontinua o semidetención, ni libertad asistida; la libertad condicional la excluye el artículo 14 del Código Penal), el 56 quater (régimen preparatorio para la liberación) y los requisitos nuevos del artículo 17 para salidas transitorias. Pedime cualquiera y te leo el texto vigente.`,
      ['Artículo 56 bis de la Ley 24.660', 'Artículo 56 quater de la Ley 24.660', 'Artículo 17 de la Ley 24.660', 'Artículo 14 del Código Penal']);
  },
  NUM: { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veinticinco: 25, treinta: 30, cincuenta: 50, cien: 100 },

  /* ---------- carga de la base ---------- */
  cargar() {
    if (this.listo) return this.listo;
    this.listo = (async () => {
      const get = async f => { const r = await fetch('knowledge/leyes/' + f); if (!r.ok) throw new Error('No se pudo leer la base jurídica'); return r.json(); };
      const idx = await get('indice.json');
      const lst = await Promise.all(idx.leyes.map(async l => ({ ...l, ...(await get(l.archivo)) })));
      this.rel = await get('relaciones.json').catch(() => ({}));
      for (const l of lst) {
        l.alias = [...new Set([...(l.alias || []).map(a => this.norm(a)), ...(this.ALIAS[l.id] || [])])];
        this.leyes[l.id] = l; this.orden.push(l.id);
        l.articulos.forEach((a, i) => {
          const tk = this.toks(a.t + ' ' + (a.u || ''));
          const tf = {}; tk.forEach(t => { tf[t] = (tf[t] || 0) + 1; });
          this.docs.push({ ley: l.id, i, a, tf, len: tk.length });
        });
      }
      for (const d of this.docs) for (const t in d.tf) this.df[t] = (this.df[t] || 0) + 1;
      this.avgLen = this.docs.reduce((s, d) => s + d.len, 0) / this.docs.length;
      return true;
    })();
    this.listo.catch(() => { this.listo = null; });
    return this.listo;
  },
  resumenBase() {
    return this.orden.map(id => { const l = this.leyes[id]; return `${l.nombre} (${l.norma}): ${l.articulos.length} artículos, texto del ${l.descargado}`; });
  },

  /* ---------- entender la pregunta ---------- */
  detectarLey(qn) {
    let best = null;
    for (const id of this.orden) for (const a of this.leyes[id].alias) {
      const re = new RegExp('(^|[^a-z0-9])' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[ .]?') + '($|[^a-z0-9])');
      if (re.test(qn) && (!best || a.length > best.len)) best = { id, len: a.length };
    }
    return best && best.id;
  },
  detectarArticulo(qn, conLey) {
    const suf = '(?:\\s*(bis|ter|quater|quinquies|sexies|septies|octies))?';
    let m = qn.match(new RegExp('\\b(?:art(?:iculo|\\.|s)?|arts?)\\s*(?:n(?:ro|umero)?\\.?\\s*)?(\\d{1,3})' + suf));
    if (!m && conLey) m = qn.match(new RegExp('(?:^|\\b(?:el|del|al|y el|y)\\s+)(\\d{1,3})' + suf + '(?:\\b|$)'));
    if (!m) m = qn.match(new RegExp('^(?:y\\s+)?(?:el\\s+)?(\\d{1,3})' + suf + '\\s*\\??$'));
    return m ? (m[1] + (m[2] ? ' ' + m[2] : '')) : null;
  },
  articulo(ley, n) {
    const L = this.leyes[ley]; if (!L) return null;
    const i = L.articulos.findIndex(a => this.norm(a.n) === this.norm(n));
    return i >= 0 ? { L, a: L.articulos[i], i } : null;
  },

  /* ---------- explicar un artículo ---------- */
  aNumeros(s) {
    // "treinta y cinco (35) años" → "35 años": si el número ya está entre paréntesis, se usa ese
    s = String(s).replace(/\b[a-záéíóú]+(?:\s+y\s+[a-záéíóú]+)?\s*\((\d+)\)/gi, (m, d) => (/^(un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieci|veint|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|doscient|trescient)/i.test(m.trim()) ? d : m));
    return String(s).replace(/\b(un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|dieciséis|diecisiete|dieciocho|diecinueve|veinte|veinticinco|treinta|cincuenta|cien)\b(?=\s*(?:\(\d+\)\s*)?(?:a\s|hasta\s|años|año|meses|mes|días|día|horas|hora))/gi,
      w => this.NUM[this.norm(w)] ?? w).replace(/\b(\d+)\s*\(\1\)/g, '$1');
  },
  explicar(L, a) {
    const t = a.t;
    // modificaciones entre paréntesis: se muestran aparte y no se leen en voz alta
    const mods = [...t.matchAll(/\(([^()]*?(?:sustituid|incorporad|derogad|modificad|vigencia)[^()]*?)\)/gi)].map(m => m[1].replace(/\s+/g, ' ').trim());
    const limpio = t.replace(/\(([^()]*?(?:sustituid|incorporad|derogad|modificad|vigencia)[^()]*?)\)/gi, '').replace(/[ \t]+/g, ' ').replace(/\s+([,.;:])/g, '$1').trim();
    const derogado = /^\s*\(?\s*(art[ií]culo\s+)?derogad/i.test(t) || (/derogad/i.test(t) && limpio.length < 25);
    // incisos: "1º …", "1) …", "a) …", "I. …"
    const partes = limpio.split(/\s*(?=(?:^|\s)(?:\d{1,2}\s?[º°)]|\d{1,2}\.\s|[a-z]\)\s|[IVX]{1,4}\.\s))/).map(s => s.trim()).filter(Boolean);
    const incisos = partes.length >= 3 ? partes.slice(1) : [];
    const encabezado = incisos.length ? partes[0] : limpio;
    // pena
    const pm = limpio.match(/(reclusi[oó]n o prisi[oó]n|prisi[oó]n o reclusi[oó]n|reclusi[oó]n|prisi[oó]n|multa|inhabilitaci[oó]n(?: especial| absoluta)?)(\s+perpetua)?(?:\s+(?:de|por)\s+((?:[a-záéíóú]+|\d+)(?:\s*\(\d+\))?\s+(?:a|hasta)\s+(?:[a-záéíóú]+|\d+)(?:\s*\(\d+\))?\s+(?:años|meses|días)|(?:[a-záéíóú]+|\d+)\s+(?:años|meses|días)))?/i);
    let pena = '';
    if (pm && /se aplicar[aá]|se impondr[aá]|ser[aá]n? reprimid|reprimid[oa]s? con|sufrir[aá]/i.test(limpio)) pena = this.aNumeros((pm[1] + (pm[2] || '') + (pm[3] ? ' de ' + pm[3].replace(/\s*\(\d+\)/g, '') : '')).replace(/\s+/g, ' '));
    // a quién se aplica: "al que matare a otro" → "a quien mate a otro"
    let quien = '';
    const qm = limpio.match(/\b(?:al|el|la) que\s+([^,.;:]{3,120})/i);
    if (qm && /are\b|ere\b|iere\b/.test(qm[1])) {
      quien = qm[1].split(/\s+siempre que|\s+salvo que|\s+cuando\s/i)[0].replace(/\b([a-záéíóúñ]+(?:are|ere|iere))\b/gi, w => this.VERBOS[this.norm(w)] || w).trim();
    }
    // glosario
    const ln = this.norm(limpio);
    const glos = this.GLOSARIO.filter(([k]) => ln.includes(k)).slice(0, 3).map(([, p, d]) => `«${p}»: ${d}`);
    // en palabras simples
    const simple = [];
    if (derogado) simple.push('Este artículo está derogado: ya no se aplica.');
    else if (this.SIMPLE[`${L.id}:${a.n}`]) simple.push(this.SIMPLE[`${L.id}:${a.n}`]);
    else {
      if (quien) simple.push(`Se aplica a quien ${quien}.`);
      if (pena) simple.push(`La pena es ${pena}.`);
      if (!quien && !pena) {
        const prim = encabezado.split(/(?<=[.;])\s+/)[0];
        simple.push(this.aNumeros(prim.length > 260 ? prim.slice(0, 257).replace(/\s\S*$/, '') + '…' : prim));
      }
      if (incisos.length) {
        // "Las sanciones aplicables son:" → se nombran los primeros supuestos
        if (/:\s*$/.test(simple[simple.length - 1] || '')) {
          const prim = incisos.slice(0, 3).map(x => x.replace(/^(?:\d{1,2}\s?[º°)]|\d{1,2}\.|[a-z]\)|[IVX]{1,4}\.)\s*/, '').replace(/[;.,:\s]+$/, '').slice(0, 90)).filter(x => x.length > 2);
          simple[simple.length - 1] += ' ' + prim.join('; ') + (incisos.length > 3 ? `; y ${incisos.length - 3} más.` : '.');
        } else simple.push(`Tiene ${incisos.length} incisos o supuestos.`);
      }
    }
    const r = this.rel[`${L.id}:${a.n}`] || {};
    const rel = [...new Set([...(r.remite || []), ...(r.citado || [])])].slice(0, 6);
    return { pena, quien, mods, incisos, encabezado, glos, simple, derogado, rel, limpio };
  },
  respuestaArticulo(L, a, i, modo) {
    const e = this.explicar(L, a);
    this.ctx = { ley: L.id, art: a.n, idx: i, pend: 'leer' };
    const titulo = `${L.nombre} — Artículo ${a.n}`;
    let decir = `Artículo ${a.n} ${this.de(L.id)}. ${this.aNumeros(e.simple.join(' '))}`;
    if (modo === 'mas') {
      if (e.incisos.length) decir += ' Los supuestos son: ' + e.incisos.map(s => this.aNumeros(s)).join('. ') + '.';
      if (e.glos.length) decir += ' Para que se entienda: ' + e.glos.join('. ') + '.';
      if (e.rel.length) decir += ' Está relacionado con ' + e.rel.map(x => this.nombreRef(x)).join(', ') + '.';
    } else if (modo !== 'leer') decir += ' ¿Querés que te lea el texto completo?';
    if (modo === 'leer') { decir = `Texto del artículo ${a.n}: ${this.aNumeros(e.limpio)}`; this.ctx.pend = null; }
    return {
      tipo: 'articulo', clave: `${L.id}:${a.n}`, titulo, ley: L.id, n: a.n, u: a.u || '', texto: a.t, ex: e,
      fuente: L.fuente || '', descargado: L.descargado || '', norma: L.norma, origen: L.origen || '', ficha: this.ficha(L, a),
      decir,
      sugerencias: [modo === 'leer' ? 'Explicame en palabras simples' : 'Leelo completo', 'El siguiente', 'Explicame más', ...(e.pena ? [] : ['¿Qué pena tiene?'])].slice(0, 4)
    };
  },
  /* Ficha normativa: norma, artículo, de dónde sale el texto, de qué fecha es y qué tan verificada está su vigencia */
  ficha(L, a) {
    const f = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s.split('-').reverse().join('/') : (s || 'NO CONSTA');
    const derogado = /derogad/i.test(a.t.slice(0, 200));
    const infoleg = !!L.fuente;
    return {
      norma: L.norma, articulo: `Artículo ${a.n}${a.u ? ' (' + a.u + ')' : ''}`,
      fuente: infoleg ? 'InfoLeg (Ministerio de Justicia de la Nación)' : (L.origen ? L.origen.replace(/\s*Transcripción:.*$|\s*Verificar.*$/, '') : 'Copia provista por el usuario'),
      url: L.fuente || '',
      fecha: infoleg ? `texto descargado el ${f(L.descargado)}` : `copia de la norma del ${f(L.descargado)}`,
      vigencia: derogado ? 'DEROGADO según el texto de la fuente'
        : infoleg ? `Texto actualizado al ${f(L.descargado)}. PENDIENTE DE VERIFICACIÓN de cambios posteriores en InfoLeg`
        : 'PENDIENTE DE VERIFICACIÓN: transcripción de una copia; confirmar con el original y con su vigencia actual'
    };
  },
  nombreRef(k) {
    const [id, n] = k.split(':'); const L = this.leyes[id];
    return L ? `artículo ${n} ${this.de(id)}` : k;
  },

  /* ---------- buscar por tema (BM25) ---------- */
  buscar(q, ley, n = 4) {
    let qt = this.toks(q);
    const base = new Set(qt);
    const extra = [];
    for (const w of this.norm(q).split(/[^a-z0-9]+/)) if (this.SINON[w]) extra.push(...this.toks(this.SINON[w]));
    qt = [...new Set([...qt, ...extra])];
    if (!qt.length) return [];
    const N = this.docs.length, k1 = 1.4, b = 0.75;
    const res = [];
    for (const d of this.docs) {
      if (ley && d.ley !== ley) continue;
      let s = 0, hit = 0;
      for (const t of qt) {
        const f = d.tf[t]; if (!f) continue;
        if (base.has(t)) hit++;
        const idf = Math.log(1 + (N - this.df[t] + 0.5) / (this.df[t] + 0.5));
        s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.len / this.avgLen));
      }
      if (s > 0) res.push({ d, s, cov: base.size ? hit / base.size : 1, base: base.size });
    }
    res.sort((x, y) => y.s - x.s);
    return res.slice(0, n);
  },

  /* ---------- ayuda sobre la app ---------- */
  AYUDA: [
    [/nota de elevaci|(ayuda|ayudame|ayudarme) (con|para|a hacer) (una |la )?nota|(hacer|redactar|armar) (una )?nota|contestar (un )?oficio|responder (un )?oficio|como (hago|armo|genero) (una )?nota/, 'Para contestar un oficio: tocá «Nuevo», cargá el PDF, la foto o pegá el texto. Revisá los datos que saqué, elegí la pestaña (por ejemplo «Elevar a la Justicia») y el modelo, escribí lo actuado y tocá «Generar borrador». Después lo revisás, lo mandás a revisión y lo descargás.', [['Contestar un oficio', 'new']]],
    [/(agreg|pon|pong|dibuj|carg|sub|sac|muev|mov|acomod|insert)\w* (la |una |mi |el )?(firma|sello)|(firma|sello) (en|de) la nota|como firmo/, 'En el borrador, en «Agregar», tocá «Firma»: podés elegir una guardada, dibujarla con el dedo o sacarle una foto al sello firmado. Después la tocás y la arrastrás para acomodarla. El sello ovalado se agrega solo al final de la nota.', [['Ir al editor', 'editor']]],
    [/vista previa|como (va a )?quedar|como sale/, 'En el borrador tocá «Vista previa»: vas a ver la hoja tal cual sale, con una línea roja donde termina. Ahí también podés acomodar la firma y, desde ahí, imprimir, bajar el PDF o compartir.', [['Ir al editor', 'editor']]],
    [/una (sola )?hoja|hoja (a4|legal|oficio)|tamano de (la )?hoja|\ba4\b/, 'La nota va en una hoja A4. Si no entra, paso sola a Legal; si tampoco, te pregunto si querés achicarla para que entre o permitir más hojas.', []],
    [/compartir|whatsapp|mandar (la nota|el pdf|el word|el documento|el borrador)/, 'Desde el borrador tocá «Compartir»: primero ves la vista previa y después elegís PDF o Word para mandarlo por WhatsApp, correo o Drive.', []],
    [/aprend/, 'Voy aprendiendo mientras trabajás: las frases que usás, lo actuado más común, las correcciones a los datos y la plantilla que elegís. Queda cifrado en este equipo y lo podés borrar en Configuración.', [['Configuración', 'settings']]],
    [/(foto|escane|ocr|no (lee|saca)|leer el oficio)/, 'Para que lea bien el oficio: foto derecha, con buena luz y sin sombras. Si algún dato no sale, en el análisis abrí «Oficio → Texto», marcá el dato con el dedo y tocá «Usar».', [['Contestar un oficio', 'new']]],
    [/(contrase|clave|usuario)\b.*(olvid|cambi|recuper|perd)|(olvid|cambi|recuper|perd).*(contrase|clave|usuario)/, 'Si te olvidaste el usuario o la contraseña, en la pantalla de ingreso están «¿Olvidó su usuario?» y «¿Olvidó su contraseña?» (con el código de recuperación).', []],
    [/(como (hago|armo|genero|hacer|armar) (un |una )?acta)|^acta(s)?$|hacer (un )?acta/, 'Para un acta: tocá «Nuevo» y, en el grupo «Acta», elegí el modelo (notificación, notificación de audiencia, comunicación telefónica, Patronato, para documentar, novedad, secuestro…). Cargá el oficio o tocá «Sin oficio», completá el empleado que suscribe y el secundante, escribí lo actuado y tocá «Generar borrador». La fecha y la hora salen solas en letras.', [['Hacer un acta', 'new']]],
    [/sangria|margen|subir (el )?(texto|titulo)|bajar (el )?(texto|titulo)|acomodar (la )?hoja/, 'En el editor, en «Párrafo», tenés «Sangría (cm)» y «Arriba (mm)». Si marcás texto, la sangría cambia solo en esos párrafos; si no, en toda la nota. También podés acomodarlo mirando la hoja entera: «Vista previa» → «Ver la hoja entera», con los botones − y +. Lo que elegís queda para las próximas del mismo tipo.', [['Ir al editor', 'editor']]],
    [/\bpin\b|entrar mas rapido|ingreso rapido/, 'En Configuración → Seguridad podés activar un PIN de 4 números para entrar más rápido en este equipo. Si lo errás 5 veces, te pide la contraseña.', [['Configuración', 'settings']]],
    [/tema (oscuro|claro)|modo oscuro|colores|paleta/, 'En Configuración → Apariencia elegís claro u oscuro y la paleta de colores.', [['Configuración', 'settings']]],
    [/pendiente|vencimiento|plazo(s)? de los oficios|que (oficios )?(tengo|falta)/, 'En «Pendientes» ves los oficios que cargaste con su plazo, ordenados por vencimiento. Te aviso cuando uno está por vencer.', [['Pendientes', 'pendientes']]],
    [/computo|calcular (la )?pena|fechas de la condena/, 'En «Cómputo» cargás la fecha de inicio y la condena y te calculo, de forma orientativa, el período de prueba, salidas transitorias, libertad condicional y asistida.', [['Cómputo', 'computo']]],
    [/ficha (del )?interno|historial del interno|todo lo de un interno/, 'En «Ficha del interno» buscás por DNI o apellido y ves todo lo que se hizo para esa persona.', [['Ficha', 'ficha']]],
    [/instalar|descargar la app|en la compu|escritorio/, 'Para instalarla: en Configuración → Instalar la app están los pasos para tu celular o computadora.', [['Configuración', 'settings']]],
    [/privacidad|(mis|los|tus) (datos|oficios|documentos) .*(guard|segur|internet|manda|envi)|donde (se )?guarda|cifrad|(usas?|necesitas?|anda sin|funciona sin) internet/, 'Todo queda en este equipo y cifrado. Yo tampoco uso internet: consulto las leyes que tengo guardadas. No mando el texto de tus oficios a ningún lado.', []]
  ],

  /* ---------- charla: lo básico que no es una consulta de leyes ---------- */
  CAPAZ: 'Te puedo ayudar con esto:\n• Leyes: buscarte un artículo («artículo 13 de la Ley 24.660»), un tema («salidas transitorias», «visita íntima») o una norma entera, leerte el texto oficial y explicártelo en palabras simples.\n• La app: cómo contestar un oficio, armar un acta, poner la firma o el sello, acomodar la sangría y la hoja, usar el PIN, los pendientes, el cómputo o la ficha del interno.\n• Cosas rápidas: la fecha y la hora, o cuántos días hay entre dos fechas.\nEscribime o hablame como te salga.',
  CHARLA: [
    [/^(y )?(en )?(que|como) (me |te )?(podes|puedes|podrias|sabes|sabe|puede) (hacer|ayudar\w*|servir|hacer por mi)|^(para|en) que (me )?(servis|sirves|sirve(s)? vos)|^que (sabes|haces|podes|puedes)( hacer)?$|^como (funcionas|te uso|se usa nexa|uso nexa)|^(necesito )?ayuda( por favor)?$|^ayudame$|^que (cosas )?(podes|puedes|sabes) (hacer|responder|contestar)/, 'capaz'],
    [/^(quien|que) (sos|eres)|^como te llamas|^(sos|eres) (una? )?(ia|inteligencia artificial|robot|persona|humano|maquina|bot)|^quien te (creo|hizo|programo)|^tu nombre/, 'quien'],
    [/^(como (estas|andas|va|te va|te encontras)|todo bien|que tal (estas|andas|todo)|como estamos)/, 'estado'],
    [/^(buenas|buen dia|que onda|holis|hola+)\b/, 'hola'],
    [/^que me (recomendas|recomiendas|sugeris|sugieres)|^(dime|decime) algo$|^en que (andas|estas)$/, 'capaz'],
    [/^(chau|adios|hasta (luego|manana|pronto|la proxima)|nos vemos|me voy)\b/, 'chau'],
    [/^(gracias|muchas gracias|mil gracias|te agradezco|genial|perfecto|excelente|barbaro|joya|buenisimo|muy bien|muy amable|listo)\b/, 'gracias'],
    [/\b(que (dia|fecha) (es|estamos)|(dia|fecha) de hoy|que dia es hoy|en que (mes|ano) estamos)\b/, 'fecha'],
    [/\b(que hora es|hora (actual|es))\b/, 'hora'],
    [/^(sos|eres) (un |una )?(inutil|tonto|tonta|malo|mala|lento|lenta)|^no (servis|sirves|entendes|entiendes|sabes nada)|^no (me )?(ayudas|sirve)/, 'queja'],
    [/(contame|dime|decime|conta|cuentame) (un )?chiste/, 'chiste'],
    [/^(ok|dale|bueno|si|no|ah|aja|claro|entiendo|entendido|ya)$/, 'ok']
  ],
  charla(qn) {
    const largo = qn.split(' ').length;
    for (const [re, k] of this.CHARLA) {
      if (!re.test(qn) || (largo > 9 && k !== 'fecha' && k !== 'hora')) continue;
      // «sí», «dale», «no» con un artículo en curso los contesta el seguimiento («¿querés que te lo lea?»)
      if (k === 'ok' && this.ctx && this.ctx.art) continue;
      const hoy = new Date(), MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'], DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      const SUG = ['Salidas transitorias', '¿Cómo hago un acta?', '¿Qué leyes tenés?'];
      switch (k) {
        case 'capaz': return this.txt(this.CAPAZ, ['Artículo 13 de la Ley 24.660', '¿Cómo hago un acta?', 'Libertad condicional', '¿Qué leyes tenés?']);
        case 'quien': return this.txt('Soy Nexa, el asistente de esta app. No soy una persona: trabajo sin internet, con las leyes guardadas en este equipo, y no mando tus datos a ningún lado. ' + this.CAPAZ.split('\n')[0], ['¿En qué me podés ayudar?', '¿Qué leyes tenés?']);
        case 'hola': return this.txt('¡Hola! Soy Nexa. ¿En qué te ayudo? Puedo buscarte una ley o un artículo, explicártelo simple, o darte una mano con la app.', ['¿En qué me podés ayudar?', 'Salidas transitorias', '¿Cómo hago un acta?']);
        case 'estado': return this.txt('Bien, lista para ayudarte. ¿Qué necesitás: una ley, un artículo o una mano con la app?', SUG);
        case 'chau': return this.txt('Hasta luego. Cuando quieras seguimos.');
        case 'gracias': return this.txt('De nada. Cuando quieras seguimos.');
        case 'fecha': return this.txt(`Hoy es ${DIA[hoy.getDay()]} ${hoy.getDate()} de ${MES[hoy.getMonth()]} de ${hoy.getFullYear()}.`);
        case 'hora': return this.txt(`Son las ${String(hoy.getHours()).padStart(2, '0')}:${String(hoy.getMinutes()).padStart(2, '0')}.`);
        case 'queja': return this.txt('Perdón. Todavía estoy aprendiendo y sé más de leyes que de charla. Probá preguntarme algo puntual, por ejemplo «¿quién autoriza las salidas transitorias?» o «artículo 13 de la Ley 24.660». Si te contesté mal, decime «no es lo que pregunté» y busco otra respuesta.', SUG);
        case 'chiste': return this.txt('Los chistes no son lo mío: lo mío son los artículos. Pero si querés, te leo uno del Código Penal.', ['Artículo 79 del Código Penal']);
        case 'ok': return this.txt('¿Seguimos con algo más? Pedime una ley, un artículo o ayuda con la app.', SUG);
      }
    }
    // «¿cuántos días hay entre el 01/03/2026 y el 15/04/2026?» / «cuántos días faltan para el 20/12/2026»
    const fs = [...qn.matchAll(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/g)].map(m => new Date(+(m[3].length === 2 ? '20' + m[3] : m[3]), +m[2] - 1, +m[1]));
    if (/cuantos dias|dias (hay|faltan|pasaron)|faltan para|pasaron desde/.test(qn) && fs.length) {
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      const [a, b] = fs.length >= 2 ? fs : [hoy, fs[0]];
      const d = Math.round((b - a) / 864e5), f = x => `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`;
      return this.txt(`Del ${f(a)} al ${f(b)} hay ${Math.abs(d)} día${Math.abs(d) === 1 ? '' : 's'} corridos${d < 0 ? ' (la segunda fecha es anterior)' : ''}.`);
    }
    return null;
  },
  /* Palabras de todos los días en la oficina judicial (no están en las leyes cargadas) */
  OFICINA: [
    [/^oficio(s)?$/, 'Un oficio es la comunicación escrita con la que un juzgado, la OGA, una fiscalía u otra autoridad le pide o le ordena algo a la Unidad (informar, notificar, trasladar, liberar…). Se contesta con una nota de elevación.'],
    [/^nota(s)? de elevacion$/, 'La nota de elevación es la respuesta de la Unidad a un oficio: informa lo que se hizo y se eleva a la autoridad que lo pidió, con el sello y la firma.'],
    [/^(un |una )?acta(s)?$/, 'Un acta es el documento donde el personal deja constancia de un hecho en el momento: una notificación, una comunicación telefónica, un secuestro, lo que pide o entrega el interno. Lleva fecha y hora en letras, el empleado que suscribe, el secundante y las firmas.'],
    [/^legajo(s)?$/, 'El legajo es la carpeta (judicial o personal) con todas las actuaciones de una causa o de un interno. El N° de legajo identifica la causa en la OGA.'],
    [/^caratula(s)?$/, 'La carátula es el nombre de la causa: el imputado y el delito, por ejemplo «GÓMEZ, Pedro s/ Robo agravado».'],
    [/^(la )?o\.?g\.?a\.?$|^oficina de gestion de audiencias$/, 'La OGA (Oficina de Gestión de Audiencias) organiza las audiencias y comunica las resoluciones de los jueces. Es quien manda muchos de los oficios.'],
    [/^exhorto(s)?$/, 'Un exhorto es el pedido que un juzgado le hace a otro de otra jurisdicción para que cumpla una diligencia.'],
    [/^cedula(s)?( de notificacion)?$/, 'La cédula es el documento con el que se notifica formalmente una resolución a una persona.'],
    [/^(un |el )?pase$/, 'El pase es la nota interna con la que se gira una actuación a otra división o área de la Unidad para que la cumpla o informe.'],
    [/^secundante$/, 'El secundante es el agente que acompaña al funcionario que labra un acta y firma como testigo del acto.'],
    [/^foja(s)?$|^fs\.?$/, 'Una foja es cada hoja de un expediente; se numeran para citar dónde está cada cosa («a fs. 12»).'],
    [/^mandato judicial$/, 'Un mandato judicial es una orden de un juez o tribunal; en la Unidad llega como oficio.']
  ],
  termino(qn) {
    const m = qn.match(/^(que (es|son|significa|quiere decir)|a que se llama|define|definicion de) (un |una |el |la |los |las )?(.+?)$/);
    if (!m) return null;
    const t = m[4].trim();
    for (const [re, d] of this.OFICINA) if (re.test(t)) return this.txt(d, ['¿Cómo hago un acta?', '¿En qué me podés ayudar?']);
    return null;
  },
  // ¿la pregunta tiene algo para buscar en las leyes? («en qué me podés ayudar» no)
  SOLO_CHARLA: new Set('me te se nos lo la le vos tu yo mi podes puedes podrias puede sabes sabe ayudar ayudarme ayudame ayudas ayuda hacer haces hace algo cosas cosa favor por bien mal nada todo che bueno ahora hoy aca alli eso esto'.split(' ')),
  sinContenido(qn) { return !this.norm(qn).split(/[^a-z0-9]+/).some(w => w.length > 2 && !this.STOP.has(w) && !this.PEDIDO.has(w) && !this.SOLO_CHARLA.has(w)); },

  /* ---------- responder ---------- */
  /* Errores de tipeo frecuentes al escribir rápido en el celular */
  corregir(qn) {
    return qn.replace(/\b(visista|vicita|visitta|visiat|vista)(s?)\b(?=\s+(entre|intima|conyugal|familiar|ordinaria|extraordinaria|de (menores|abogad|familiar|intern|hijos)))/g, 'visita$2')
      .replace(/\b(visista|vicita|visitta|visiat)(s?)\b/g, 'visita$2').replace(/\bintenos?\b/g, m => m.replace('intenos', 'internos').replace('inteno', 'interno'))
      .replace(/\bsancione?s?\b/g, m => m).replace(/\btransitorai/g, 'transitoria').replace(/\bcondiconal/g, 'condicional');
  },
  /* «Puedes responder lo que te pedí», «no me respondiste», «nada que ver»: la respuesta anterior no sirvió */
  RECLAMO: /^(pod(e|es|rias?)|puedes|podria(s)?)?\s*(responder|contestar)( bien)?( lo que| a lo que| mi pregunta)|no (me )?(respondiste|contestaste)|no (es|era) (lo|eso) (que|lo que)|eso no (es|era)|te (pregunte|pedi) (otra|algo)|nada que ver|no tiene nada que ver|no es lo que (te )?(pregunte|pedi)|respond(e|eme) (bien|lo que)|lo que te (pedi|pregunte)/,
  async reintentar() {
    const p = this.ultima;
    if (!p) return this.txt('Decime de nuevo qué querés saber y lo busco.');
    const antes = this.ultimaClave;
    const r = await this.preguntar(p.q, { sinAyuda: true, excluir: antes, excluidas: p.excluidas });
    // si antes contestó sobre la app y ahora solo queda una búsqueda por palabras, no se inventa una respuesta
    if (r.clave && p.excluidas.has(r.clave) || r.sinResultado || (antes === 'ayuda' && r.via === 'busqueda')) {
      return this.txt(`Perdón, no tengo una respuesta mejor para «${p.q}». Probá decirlo con otras palabras o pedime directamente la norma o el artículo (por ejemplo «visitas entre internos» o «artículo 71 del decreto 1136/97»).`, ['¿Qué leyes tenés?']);
    }
    if (r.clave) { p.excluidas.add(r.clave); this.ultimaClave = r.clave; }
    r.nota = `Perdón, la respuesta anterior no era lo que preguntaste. Sobre «${p.q}»:`;
    r.decir = `Perdón. ${r.decir}`;
    if (r.tipo === 'texto') r.texto = r.nota + '\n' + r.texto;
    return r;
  },
  async preguntar(texto, opc = {}) {
    const q = String(texto || '').trim();
    const qn = this.corregir(this.norm(q).replace(/[¿?¡!]/g, '').trim());
    if (this.RECLAMO.test(qn) && qn.split(' ').length <= 9 && !opc.excluir) { await this.cargar(); return this.reintentar(); }
    const r = await this.responder(q, qn, opc);
    // se recuerda la última pregunta de verdad (no la charla) para poder volver a contestarla
    const charla = /^(hola|buen(os|as)|que tal|hey|gracias|muchas gracias|genial|perfecto|listo|si|dale|ok|bueno|no|leelo|lee|leer|el siguiente|siguiente|el anterior|anterior|explicame mas|mas simple|que pena|cuanta pena|relacionad|quien sos|que sos|que podes|ayuda)\b/.test(qn) && qn.split(' ').length <= 5 || !!this.charla(qn);
    if (r && !charla && !opc.excluir) { this.ultima = { q, excluidas: new Set(r.clave ? [r.clave] : []) }; this.ultimaClave = r.clave || null; }
    return r;
  },
  async responder(q, qn, opc) {
    // al volver a contestar, no se repite nada de lo ya respondido a esta pregunta
    const ya = opc.excluidas || new Set(opc.excluir ? [opc.excluir] : []), fuera = k => ya.has(k);
    if (!qn) return this.txt('Decime qué querés consultar: por ejemplo «artículo 79 del Código Penal» o «salidas transitorias».');
    // charla
    if (/^(hola|buen(os|as) (dias|tardes|noches)|que tal|hey)\b/.test(qn)) return this.txt('Hola, soy Nexa. Conozco a fondo la ejecución de la pena: Ley 24.660 con la reforma de la Ley 27.375 y sus reglamentos (Decreto 396/99 de progresividad, disciplina, visitas y comunicaciones, educación, recompensas y procesados), la Ley 9.914 y la Resolución 905/19 de Tucumán. También el Código Penal, la Constitución, la Ley 23.737 y los códigos procesales. ¿Qué necesitás?', ['Salidas transitorias', '¿Qué cambió la Ley 27.375?', 'Visita íntima', '¿Qué leyes tenés?']);
    if (/^(gracias|muchas gracias|genial|perfecto|listo)\b/.test(qn)) return this.txt('De nada. Cuando quieras seguimos.');
    { const ch = this.charla(qn) || this.termino(qn); if (ch) return ch; }
    if (/(quien sos|que sos|que podes hacer|que haces|ayuda$|^ayuda)/.test(qn)) return this.txt('Soy Nexa, el asistente de esta app. Funciono sin internet: busco en las leyes guardadas en el equipo, te leo el texto oficial y te lo explico en palabras simples. Podés escribirme o hablarme. También te explico cómo usar la app.', ['¿Qué leyes tenés?', 'Artículo 13 de la Ley 24.660', '¿Cómo hago una nota de elevación?']);
    await this.cargar();
    if (/(que|cuales) (leyes|normas|codigos)|que tenes cargado|base juridica/.test(qn)) return this.txt('Tengo cargadas estas normas, con el texto oficial y la fecha en que se descargó:\n• ' + this.resumenBase().join('\n• '), ['¿Qué cambió la Ley 27.375?', 'Salidas transitorias', 'Libertad condicional']);
    // seguimiento de la conversación
    const c = this.ctx, act = c.ley && c.art ? this.articulo(c.ley, c.art) : null;
    const corta = qn.split(' ').length <= 6 && !this.detectarLey(qn) && !this.TEMAS.some(([re]) => re.test(qn));
    if (act && corta) {
      if (/^(si|dale|ok|bueno|leelo|lee(lo)? completo|leelo completo|texto completo|lee el texto|leer)\b/.test(qn) && (c.pend === 'leer' || /lee/.test(qn))) return this.respuestaArticulo(act.L, act.a, act.i, 'leer');
      if (/^no\b/.test(qn) && c.pend) { c.pend = null; return this.txt('Bueno. ¿Querés consultar otro artículo o tema?'); }
      if (/(siguiente|proximo|el que sigue|que sigue)/.test(qn) && act.i + 1 < act.L.articulos.length) return this.respuestaArticulo(act.L, act.L.articulos[act.i + 1], act.i + 1);
      if (/(anterior|el de antes)/.test(qn) && act.i > 0) return this.respuestaArticulo(act.L, act.L.articulos[act.i - 1], act.i - 1);
      if (/\b(explica\w*|mas simple|palabras simples|mas|mejor|no entendi|que significa|como es eso)\b/.test(qn) && !this.detectarArticulo(qn, true)) return this.respuestaArticulo(act.L, act.a, act.i, 'mas');
      if (/\b(que pena|cuanta pena|pena tiene|cuantos anos|pena)\b/.test(qn) && !this.detectarArticulo(qn, true)) {
        const e = this.explicar(act.L, act.a);
        return this.txt(e.pena ? `El artículo ${act.a.n} prevé ${e.pena}.` : `El artículo ${act.a.n} no fija una pena por sí mismo.${e.rel.length ? ' Remite a ' + e.rel.map(x => this.nombreRef(x)).join(', ') + '.' : ''}`, ['Leelo completo', 'El siguiente']);
      }
      if (/\b(relacionad\w*|relaciones|remite|remisiones|lo citan)\b/.test(qn)) {
        const e = this.explicar(act.L, act.a);
        return e.rel.length ? this.txt(`El artículo ${act.a.n} está relacionado con: ${e.rel.map(x => this.nombreRef(x)).join(', ')}.`, e.rel.slice(0, 3).map(x => this.nombreRef(x)))
          : this.txt(`No tengo registradas remisiones del artículo ${act.a.n}.`);
      }
    }
    // la reforma de la Ley 27.375: qué artículos cambió (se arma con las notas de InfoLeg del texto de la Ley 24.660)
    if (/27\s?\.?375/.test(qn) && /(cambi|modific|reform|resumen|que (es|dice|hizo|establece)|en que consiste|explica)/.test(qn) && !this.detectarArticulo(qn, true) && this.leyes.ep) return this.reforma27375();
    // la norma entera: «explicame el decreto 396/99», «¿qué es la 24.660?», «decreto 18/97»
    { const ln = this.detectarLey(qn); if (ln && !this.detectarArticulo(this.sinNormas(qn, [ln]), true) && this.pideNorma(qn, ln)) return ln === 'l27375' && this.leyes.ep ? this.reforma27375() : this.panorama(this.leyes[ln]); }
    // normas que todavía no están
    for (const [re, nom] of this.FALTAN) if (re.test(qn)) return this.txt(`Todavía no tengo cargada ${nom}, así que no te puedo leer el texto oficial. Consultala en InfoLeg y, si querés, la sumamos a la base más adelante.`);
    // artículo puntual
    let ley = this.detectarLey(qn);
    // «hablame del 396/99»: el número de la norma no es un artículo
    const n = this.detectarArticulo(ley ? this.sinNormas(qn, [ley]) : qn.replace(/\b\d+\s?\/\s?\d+\b/g, ' '), !!(ley || c.ley));
    if (n) {
      if (!ley && c.ley && !/(codigo|ley)\b/.test(qn)) ley = c.ley;
      if (!ley) {
        const en = this.orden.filter(id => this.articulo(id, n)).slice(0, 4);
        if (!en.length) return this.txt(`No encontré un artículo ${n} en las normas que tengo.`);
        if (en.length === 1) { const x = this.articulo(en[0], n); return this.respuestaArticulo(x.L, x.a, x.i); }
        this.ctx.pend = null;
        return this.txt(`¿De qué norma es el artículo ${n}?`, en.map(id => `Artículo ${n} ${this.de(id)}`));
      }
      let x = this.articulo(ley, n);
      // la norma venía de la pregunta anterior y no tiene ese artículo: se busca en las demás («56 bis» después de hablar del Código Penal)
      if (!x && !this.detectarLey(qn)) {
        const en = this.orden.filter(id => this.articulo(id, n));
        if (en.length === 1) x = this.articulo(en[0], n);
        else if (en.length > 1) { this.ctx.pend = null; return this.txt(`¿De qué norma es el artículo ${n}?`, en.slice(0, 4).map(id => `Artículo ${n} ${this.de(id)}`)); }
      }
      if (!x) return this.txt(`No encontré el artículo ${n} en ${this.leyes[ley].nombre}. Puede que no exista o que esté numerado distinto.`);
      return this.respuestaArticulo(x.L, x.a, x.i);
    }
    // ayuda sobre la app
    for (const [re, t, acc] of this.AYUDA) if (re.test(qn) && !ley && !opc.sinAyuda) return { ...this.txt(t), clave: 'ayuda', acciones: acc.map(([l, nav]) => ({ label: l, nav })) };
    // temas frecuentes: los artículos principales primero
    for (const [re, keys] of this.TEMAS) if (re.test(qn)) {
      const todos = keys.map(k => { const [id, nn] = k.split(':'); return this.articulo(id, nn); }).filter(Boolean);
      let xs = todos.filter(x => !ley || x.L.id === ley), nota = '';
      // la norma pedida no trata el tema: se responde con la que sí lo trata, avisando
      if (!xs.length && todos.length) { xs = todos; nota = `En ${this.leyes[ley].nombre} no encontré ese tema. `; }
      if (!xs.length) continue;
      xs = this.afinarTema(q, xs, fuera);
      if (!xs.length) continue;
      const asp = this.aspectos(qn);
      if (asp.length >= 2 && ![...ya].some(k => k.startsWith('tema:'))) { const r = this.respuestaAspectos(q, qn, asp, xs, fuera); if (r) return r; }
      if (asp.length === 1) {
        // una sola cosa puntual («quién autoriza…», «cuánto dura…»): va primero el artículo que la responde
        const re = asp[0][2], lit = this.literales(qn, asp[0]);
        // solo compite la misma norma: un decreto no desplaza al artículo de la ley
        const m = this.mejorPara(re, this.candidatos(qn, asp, xs, fuera).filter(x => x.L === xs[0].L), [], lit), m0 = this.mejorPara(re, [{ ...xs[0], rel: 0.5 }], [], lit);
        // el artículo principal del tema queda primero salvo que otro responda claramente mejor (los requisitos siguen en el 17)
        if (m && !(m.x.L === xs[0].L && m.x.a.n === xs[0].a.n) && m.sc > (m0 ? m0.sc : 0) + 0.3) xs = [m.x, ...xs.filter(x => !(x.L === m.x.L && x.a.n === m.x.a.n))];
      }
      const resp = this.respuestaArticulo(xs[0].L, xs[0].a, xs[0].i);
      resp.otros = xs.slice(1).map(x => ({ ley: x.L.id, n: x.a.n, nombre: x.L.abrev || x.L.nombre, t: x.a.t.slice(0, 140) }));
      resp.decir = `${nota}Sobre eso, lo principal está en el ${resp.decir.charAt(0).toLowerCase() + resp.decir.slice(1)}${resp.otros.length ? ' También te dejo ' + resp.otros.map(o => 'el artículo ' + o.n + ' ' + this.de(o.ley)).join(', ') + '.' : ''}`;
      return resp;
    }
    // sin nada que buscar en las leyes: no se responde con un artículo cualquiera
    if (!ley && this.sinContenido(qn)) return Object.assign(this.txt(this.CAPAZ, ['¿Qué leyes tenés?', 'Salidas transitorias', '¿Cómo hago un acta?']), { sinResultado: true });
    // por tema
    const r = this.buscar(q, ley, 6).filter(x => !fuera(`${x.d.ley}:${x.d.a.n}`) && (x.base < 2 || x.cov >= 0.5)).slice(0, 4);
    if (!r.length || r[0].s < 2.2) return Object.assign(this.txt('No encontré eso en las normas que tengo. Probá con otras palabras o pedime un artículo puntual (por ejemplo «artículo 13 de la Ley 24.660»).', ['¿Qué leyes tenés?', 'Salidas transitorias', 'Libertad condicional']), { sinResultado: true });
    const top = r[0].d, L = this.leyes[top.ley];
    const resp = this.respuestaArticulo(L, top.a, top.i);
    resp.otros = r.slice(1).filter(x => x.s > r[0].s * 0.45).map(x => ({ ley: x.d.ley, n: x.d.a.n, nombre: this.leyes[x.d.ley].abrev || this.leyes[x.d.ley].nombre, t: x.d.a.t.slice(0, 140) }));
    resp.decir = `Lo más relacionado que encontré es el ${resp.decir.charAt(0).toLowerCase() + resp.decir.slice(1)}`;
    resp.via = 'busqueda';
    return resp;
  },
  txt(t, sugerencias = []) { return { tipo: 'texto', texto: t, decir: t.replace(/\n•/g, '.').replace(/\n/g, ' '), sugerencias }; },

  /* Referencias a leyes dentro de un oficio: "art. 13 de la Ley 24.660" → para consultarlas con un toque */
  referencias(texto) {
    const out = [], vistos = new Set();
    const tn = this.norm(texto);
    for (const m of tn.matchAll(/\bart(?:iculo|s?\.?)\s*(\d{1,3})(?:\s*(bis|ter))?\s*(?:,?\s*inc(?:iso|\.)?\s*\w+)?\s*(?:de la|del|de)\s+((?:ley\s*(?:n\s*)?[\d. ]+)|(?:codigo [a-z ]{4,40}?)|(?:c\.? ?p\.?))(?=[,.;)\s]|$)/g)) {
      const ley = this.detectarLey(this.norm(m[3]));
      if (!ley) continue;
      const k = ley + ':' + m[1] + (m[2] ? ' ' + m[2] : '');
      if (vistos.has(k)) continue; vistos.add(k);
      out.push({ ley, n: m[1] + (m[2] ? ' ' + m[2] : ''), consulta: `Artículo ${m[1]}${m[2] ? ' ' + m[2] : ''} ${this.de(ley)}` });
    }
    return out.slice(0, 6);
  },
  reiniciar() { this.ctx = { ley: null, art: null, pend: null }; }
};
