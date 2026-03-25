<?php
/**
 * NordcsCare - Teste de Carga (500 alunos)
 * Simula um dia completo de atendimento oftalmológico escolar
 * 
 * Fluxo: Check-in → Acuidade → Exames → Laudos → Destino final
 * Destinos: Alta, Óculos, Encaminhamento, Óculos+Encaminhamento
 */

$BASE_URL = 'http://localhost/NordcsCare/api';
$TOTAL_ALUNOS = 500;
$ESCOLA = 'Escola Teste Carga - ' . date('Y-m-d H:i:s');

// Contadores e métricas
$metricas = [
    'inicio' => microtime(true),
    'login' => 0,
    'cadastro_pacientes' => ['sucesso' => 0, 'erro' => 0, 'tempo_total' => 0],
    'checkin_fila' => ['sucesso' => 0, 'erro' => 0, 'tempo_total' => 0],
    'acuidade' => ['sucesso' => 0, 'erro' => 0, 'tempo_total' => 0],
    'exames' => ['sucesso' => 0, 'erro' => 0, 'tempo_total' => 0],
    'laudos' => ['sucesso' => 0, 'erro' => 0, 'tempo_total' => 0],
    'prescricoes' => ['sucesso' => 0, 'erro' => 0, 'tempo_total' => 0],
    'consulta_prontuario' => ['sucesso' => 0, 'erro' => 0, 'tempo_total' => 0],
    'consulta_fila' => ['sucesso' => 0, 'erro' => 0, 'tempo_total' => 0],
    'dashboard' => ['sucesso' => 0, 'erro' => 0, 'tempo_total' => 0],
    'erros_detalhados' => [],
    'tempos_por_etapa' => [],
    'condutas' => ['alta' => 0, 'encaminhamento' => 0, 'onibus' => 0, 'onibus_encaminhamento' => 0],
];

// Dados de diagnósticos realistas
$diagnosticos = [
    'Miopia leve', 'Miopia moderada', 'Miopia severa',
    'Hipermetropia leve', 'Hipermetropia moderada',
    'Astigmatismo', 'Astigmatismo misto',
    'Ambliopia OD', 'Ambliopia OE',
    'Estrabismo convergente', 'Estrabismo divergente',
    'Sem alterações', 'Sem alterações significativas',
    'Pterígio grau I', 'Conjuntivite alérgica',
    'Blefarite', 'Olho seco',
];

$condutas_iniciais = ['alta', 'encaminhamento', 'onibus', 'onibus_encaminhamento'];
$condutas_pesos = [45, 15, 30, 10]; // % realista: 45% alta, 15% encaminhamento, 30% óculos, 10% óculos+encaminhamento

// Nomes brasileiros para dados realistas
$nomes = ['Ana', 'Pedro', 'Maria', 'João', 'Lucas', 'Julia', 'Gabriel', 'Isabela', 'Mateus', 'Laura', 
           'Rafael', 'Beatriz', 'Gustavo', 'Manuela', 'Felipe', 'Valentina', 'Thiago', 'Sofia', 'Bruno', 'Helena',
           'Daniel', 'Alice', 'Leonardo', 'Lara', 'Henrique', 'Giovanna', 'Arthur', 'Mariana', 'Nicolas', 'Camila'];
$sobrenomes = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Almeida', 'Pereira', 'Lima', 'Gomes',
                'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Araújo', 'Melo', 'Barbosa', 'Rocha', 'Dias', 'Nascimento'];

function request(string $method, string $url, ?array $data = null, string $token = ''): array {
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_CUSTOMREQUEST => $method,
    ]);
    
    $headers = ['Content-Type: application/json'];
    if ($token) $headers[] = "Authorization: Bearer $token";
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    
    if ($data !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }
    
    $start = microtime(true);
    $response = curl_exec($ch);
    $tempo = microtime(true) - $start;
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    return [
        'status' => $httpCode,
        'body' => json_decode($response, true) ?? [],
        'tempo' => $tempo,
        'error' => $error,
        'raw' => $response,
    ];
}

function escolherConduta(array $pesos): string {
    global $condutas_iniciais;
    $rand = mt_rand(1, 100);
    $acumulado = 0;
    foreach ($pesos as $i => $peso) {
        $acumulado += $peso;
        if ($rand <= $acumulado) return $condutas_iniciais[$i];
    }
    return 'alta';
}

function gerarAcuidade(): string {
    $valores = ['20/20', '20/25', '20/30', '20/40', '20/50', '20/60', '20/70', '20/100', '20/200'];
    return $valores[array_rand($valores)];
}

function gerarGrau(): string {
    $valores = ['-0.25', '-0.50', '-0.75', '-1.00', '-1.25', '-1.50', '-2.00', '-2.50', '-3.00', '+0.25', '+0.50', '+0.75', '+1.00', '+1.50', '+2.00', '0.00'];
    return $valores[array_rand($valores)];
}

function gerarEixo(): string {
    return (string)mt_rand(0, 180);
}

function printProgress(string $etapa, int $atual, int $total, float $tempoEtapa): void {
    $pct = round($atual / $total * 100);
    $bar = str_repeat('█', (int)($pct / 5)) . str_repeat('░', 20 - (int)($pct / 5));
    $ms = round($tempoEtapa * 1000);
    echo "\r  [$bar] $pct% ($atual/$total) - {$ms}ms   ";
    if ($atual === $total) echo "\n";
}

// ==========================================
// INÍCIO DO TESTE
// ==========================================
echo "\n";
echo "╔══════════════════════════════════════════════════════════════╗\n";
echo "║     NORDCSCARE - TESTE DE CARGA: $TOTAL_ALUNOS ALUNOS              ║\n";
echo "║     Simulação de Dia Completo de Atendimento               ║\n";
echo "╚══════════════════════════════════════════════════════════════╝\n\n";

// 1. LOGIN
echo "🔐 Fazendo login...\n";
$loginStart = microtime(true);
$res = request('POST', "$BASE_URL/auth/login", [
    'login' => 'admin',
    'senha' => 'admin123'
]);
$metricas['login'] = microtime(true) - $loginStart;

if ($res['status'] !== 200 || empty($res['body']['token'])) {
    echo "❌ ERRO NO LOGIN: " . ($res['raw'] ?? 'sem resposta') . "\n";
    echo "   Verifique se o servidor está rodando e as credenciais estão corretas.\n";
    exit(1);
}
$token = $res['body']['token'];
echo "   ✅ Login OK (" . round($metricas['login'] * 1000) . "ms)\n\n";

// 2. CADASTRO DE 500 PACIENTES
echo "📋 Etapa 1/7: Cadastrando $TOTAL_ALUNOS pacientes...\n";
$pacienteIds = [];
for ($i = 1; $i <= $TOTAL_ALUNOS; $i++) {
    $nome = $nomes[array_rand($nomes)] . ' ' . $sobrenomes[array_rand($sobrenomes)] . ' ' . $sobrenomes[array_rand($sobrenomes)];
    $idade = mt_rand(5, 17);
    $nascimento = date('Y-m-d', strtotime("-$idade years -" . mt_rand(0, 364) . " days"));
    
    $res = request('POST', "$BASE_URL/pacientes", [
        'nome_completo' => "$nome #$i",
        'data_nascimento' => $nascimento,
        'sexo' => mt_rand(0, 1) ? 'M' : 'F',
        'escola' => $ESCOLA,
        'responsavel' => $nomes[array_rand($nomes)] . ' ' . $sobrenomes[array_rand($sobrenomes)],
        'telefone' => '(' . mt_rand(11, 99) . ') 9' . mt_rand(1000, 9999) . '-' . mt_rand(1000, 9999),
    ], $token);
    
    $metricas['cadastro_pacientes']['tempo_total'] += $res['tempo'];
    
    if ($res['status'] === 201 && !empty($res['body']['id'])) {
        $pacienteIds[] = $res['body']['id'];
        $metricas['cadastro_pacientes']['sucesso']++;
    } else {
        $metricas['cadastro_pacientes']['erro']++;
        if (count($metricas['erros_detalhados']) < 10) {
            $metricas['erros_detalhados'][] = "Cadastro #$i: HTTP {$res['status']} - " . json_encode($res['body']);
        }
    }
    printProgress('Cadastro', $i, $TOTAL_ALUNOS, $res['tempo']);
}
$metricas['tempos_por_etapa']['cadastro'] = $metricas['cadastro_pacientes']['tempo_total'];

// 3. CHECK-IN NA FILA (todos entram na acuidade)
echo "\n🏥 Etapa 2/7: Check-in na fila ($TOTAL_ALUNOS pacientes)...\n";
$filaIds = [];
for ($i = 0; $i < count($pacienteIds); $i++) {
    $res = request('POST', "$BASE_URL/fila", [
        'paciente_id' => $pacienteIds[$i],
    ], $token);
    
    $metricas['checkin_fila']['tempo_total'] += $res['tempo'];
    
    if ($res['status'] === 201 && !empty($res['body']['id'])) {
        $filaIds[$pacienteIds[$i]] = $res['body']['id'];
        $metricas['checkin_fila']['sucesso']++;
    } else {
        $metricas['checkin_fila']['erro']++;
    }
    printProgress('Check-in', $i + 1, count($pacienteIds), $res['tempo']);
}
$metricas['tempos_por_etapa']['checkin'] = $metricas['checkin_fila']['tempo_total'];

// 4. ACUIDADE VISUAL (técnicos medem visão)
echo "\n👁️  Etapa 3/7: Registro de acuidade visual...\n";
$count = 0;
foreach ($pacienteIds as $pacienteId) {
    $count++;
    $usaOculos = mt_rand(0, 100) < 35; // 35% já usa óculos
    
    $acuidadeData = [
        'acuidade_visual' => [
            'sem_oculos_OD' => gerarAcuidade(),
            'sem_oculos_OE' => gerarAcuidade(),
            'usa_oculos' => $usaOculos ? 1 : 0,
            'dilata' => mt_rand(0, 100) < 20 ? 1 : 0, // 20% dilata
        ]
    ];
    if ($usaOculos) {
        $acuidadeData['acuidade_visual']['com_oculos_OD'] = gerarAcuidade();
        $acuidadeData['acuidade_visual']['com_oculos_OE'] = gerarAcuidade();
    }
    
    $res = request('POST', "$BASE_URL/prontuario/$pacienteId/atendimento", $acuidadeData, $token);
    $metricas['acuidade']['tempo_total'] += $res['tempo'];
    
    if (in_array($res['status'], [200, 201])) {
        $metricas['acuidade']['sucesso']++;
    } else {
        $metricas['acuidade']['erro']++;
    }
    printProgress('Acuidade', $count, count($pacienteIds), $res['tempo']);
}
$metricas['tempos_por_etapa']['acuidade'] = $metricas['acuidade']['tempo_total'];

// Consultar fila atual
echo "\n📊 Consultando estado da fila...\n";
$res = request('GET', "$BASE_URL/fila", null, $token);
$metricas['consulta_fila']['tempo_total'] += $res['tempo'];
if ($res['status'] === 200) {
    $metricas['consulta_fila']['sucesso']++;
    $filaData = $res['body'];
    echo "   Fila atual: ";
    foreach ($filaData as $estacao => $items) {
        if (is_array($items)) echo "$estacao(" . count($items) . ") ";
    }
    echo "\n";
}

// 5. EXAMES (médico realiza exames)
echo "\n🔬 Etapa 4/7: Registro de exames oftalmológicos...\n";
$count = 0;
foreach ($pacienteIds as $pacienteId) {
    $count++;
    $tiposExame = ['refracao', 'tonometria', 'spot_vision', 'eyer', 'retinografia', 'outro'];
    $tipoEscolhido = $tiposExame[array_rand($tiposExame)];
    $exameData = [
        'exames' => [
            [
                'tipo_exame' => 'refracao',
                'olho' => 'OD',
                'resultado' => 'Esférico: ' . gerarGrau() . ' Cilíndrico: ' . gerarGrau() . ' Eixo: ' . gerarEixo() . '°',
            ],
            [
                'tipo_exame' => 'refracao',
                'olho' => 'OE',
                'resultado' => 'Esférico: ' . gerarGrau() . ' Cilíndrico: ' . gerarGrau() . ' Eixo: ' . gerarEixo() . '°',
            ],
            [
                'tipo_exame' => $tipoEscolhido,
                'olho' => 'AO',
                'resultado' => 'Sem alterações',
            ],
        ]
    ];
    
    $res = request('POST', "$BASE_URL/prontuario/$pacienteId/atendimento", $exameData, $token);
    $metricas['exames']['tempo_total'] += $res['tempo'];
    
    if (in_array($res['status'], [200, 201])) {
        $metricas['exames']['sucesso']++;
    } else {
        $metricas['exames']['erro']++;
    }
    printProgress('Exames', $count, count($pacienteIds), $res['tempo']);
}
$metricas['tempos_por_etapa']['exames'] = $metricas['exames']['tempo_total'];

// 6. LAUDOS (médico faz diagnóstico)
echo "\n📝 Etapa 5/7: Emissão de laudos médicos...\n";
$count = 0;
$condutasPorPaciente = [];
foreach ($pacienteIds as $pacienteId) {
    $count++;
    $conduta = escolherConduta($condutas_pesos);
    $condutasPorPaciente[$pacienteId] = $conduta;
    $metricas['condutas'][$conduta]++;
    
    $condutaFinal = $conduta;
    if ($conduta === 'onibus') $condutaFinal = 'alta';
    if ($conduta === 'onibus_encaminhamento') $condutaFinal = 'encaminhamento';
    
    $laudoData = [
        'laudo' => [
            'diagnostico' => $diagnosticos[array_rand($diagnosticos)],
            'conduta_inicial' => $conduta,
            'conduta_final' => $condutaFinal,
            'observacoes' => mt_rand(0, 100) < 30 ? 'Retorno em 6 meses para acompanhamento.' : '',
        ]
    ];
    
    $res = request('POST', "$BASE_URL/prontuario/$pacienteId/atendimento", $laudoData, $token);
    $metricas['laudos']['tempo_total'] += $res['tempo'];
    
    if (in_array($res['status'], [200, 201])) {
        $metricas['laudos']['sucesso']++;
    } else {
        $metricas['laudos']['erro']++;
    }
    printProgress('Laudos', $count, count($pacienteIds), $res['tempo']);
}
$metricas['tempos_por_etapa']['laudos'] = $metricas['laudos']['tempo_total'];

// 7. PRESCRIÇÕES (para quem precisa de óculos)
$pacientesOculos = array_filter($condutasPorPaciente, fn($c) => in_array($c, ['onibus', 'onibus_encaminhamento']));
$totalOculos = count($pacientesOculos);
echo "\n👓 Etapa 6/7: Prescrições de óculos ($totalOculos pacientes)...\n";
$count = 0;
foreach ($pacientesOculos as $pacienteId => $conduta) {
    $count++;
    $condutaFinal = ($conduta === 'onibus_encaminhamento') ? 'encaminhamento' : 'alta';
    
    $prescricaoData = [
        'prescricao' => [
            'esferico_od' => gerarGrau(),
            'cilindrico_od' => gerarGrau(),
            'eixo_od' => gerarEixo(),
            'esferico_oe' => gerarGrau(),
            'cilindrico_oe' => gerarGrau(),
            'eixo_oe' => gerarEixo(),
            'adicao_od' => '0.00',
            'adicao_oe' => '0.00',
            'dp' => (string)mt_rand(56, 68),
            'conduta_final' => $condutaFinal,
        ]
    ];
    
    $res = request('POST', "$BASE_URL/prontuario/$pacienteId/atendimento", $prescricaoData, $token);
    $metricas['prescricoes']['tempo_total'] += $res['tempo'];
    
    if (in_array($res['status'], [200, 201])) {
        $metricas['prescricoes']['sucesso']++;
    } else {
        $metricas['prescricoes']['erro']++;
    }
    printProgress('Prescrições', $count, $totalOculos, $res['tempo']);
}
$metricas['tempos_por_etapa']['prescricoes'] = $metricas['prescricoes']['tempo_total'];

// 8. CONSULTAS DE PRONTUÁRIO (simula consultas aleatórias durante o dia)
$totalConsultas = min(100, count($pacienteIds));
echo "\n🔍 Etapa 7/7: Consultas de prontuário ($totalConsultas consultas)...\n";
$consultaIds = array_rand(array_flip($pacienteIds), $totalConsultas);
if (!is_array($consultaIds)) $consultaIds = [$consultaIds];
$count = 0;
foreach ($consultaIds as $pacienteId) {
    $count++;
    $res = request('GET', "$BASE_URL/prontuario/$pacienteId", null, $token);
    $metricas['consulta_prontuario']['tempo_total'] += $res['tempo'];
    
    if ($res['status'] === 200) {
        $metricas['consulta_prontuario']['sucesso']++;
    } else {
        $metricas['consulta_prontuario']['erro']++;
    }
    printProgress('Prontuários', $count, $totalConsultas, $res['tempo']);
}
$metricas['tempos_por_etapa']['consulta_prontuario'] = $metricas['consulta_prontuario']['tempo_total'];

// DASHBOARD (consulta métricas)
echo "\n📈 Consultando dashboard...\n";
$res = request('GET', "$BASE_URL/dashboard/metricas", null, $token);
$metricas['dashboard']['tempo_total'] += $res['tempo'];
if ($res['status'] === 200) {
    $metricas['dashboard']['sucesso']++;
    echo "   ✅ Dashboard OK (" . round($res['tempo'] * 1000) . "ms)\n";
} else {
    $metricas['dashboard']['erro']++;
    echo "   ❌ Dashboard ERRO\n";
}

// FILA FINAL
echo "\n📊 Consultando fila final...\n";
$res = request('GET', "$BASE_URL/fila", null, $token);
$metricas['consulta_fila']['tempo_total'] += $res['tempo'];
if ($res['status'] === 200) {
    $metricas['consulta_fila']['sucesso']++;
    echo "   Estado final da fila:\n";
    foreach ($res['body'] as $estacao => $items) {
        if (is_array($items)) {
            echo "     $estacao: " . count($items) . " pacientes\n";
        }
    }
}

// ==========================================
// RELATÓRIO FINAL
// ==========================================
$tempoTotal = microtime(true) - $metricas['inicio'];
$totalReqs = $metricas['cadastro_pacientes']['sucesso'] + $metricas['cadastro_pacientes']['erro']
    + $metricas['checkin_fila']['sucesso'] + $metricas['checkin_fila']['erro']
    + $metricas['acuidade']['sucesso'] + $metricas['acuidade']['erro']
    + $metricas['exames']['sucesso'] + $metricas['exames']['erro']
    + $metricas['laudos']['sucesso'] + $metricas['laudos']['erro']
    + $metricas['prescricoes']['sucesso'] + $metricas['prescricoes']['erro']
    + $metricas['consulta_prontuario']['sucesso'] + $metricas['consulta_prontuario']['erro']
    + $metricas['consulta_fila']['sucesso'] + $metricas['consulta_fila']['erro']
    + $metricas['dashboard']['sucesso'] + $metricas['dashboard']['erro']
    + 1; // login

$totalSucesso = $metricas['cadastro_pacientes']['sucesso'] + $metricas['checkin_fila']['sucesso']
    + $metricas['acuidade']['sucesso'] + $metricas['exames']['sucesso']
    + $metricas['laudos']['sucesso'] + $metricas['prescricoes']['sucesso']
    + $metricas['consulta_prontuario']['sucesso'] + $metricas['consulta_fila']['sucesso']
    + $metricas['dashboard']['sucesso'] + 1;

$totalErro = $totalReqs - $totalSucesso;

echo "\n\n";
echo "╔══════════════════════════════════════════════════════════════╗\n";
echo "║                   RELATÓRIO DO TESTE DE CARGA              ║\n";
echo "╠══════════════════════════════════════════════════════════════╣\n";
printf("║  Alunos simulados:     %-36s ║\n", number_format($TOTAL_ALUNOS));
printf("║  Total de requisições: %-36s ║\n", number_format($totalReqs));
printf("║  Tempo total:          %-36s ║\n", round($tempoTotal, 1) . " segundos");
printf("║  Req/segundo médio:    %-36s ║\n", round($totalReqs / $tempoTotal, 1));
printf("║  Taxa de sucesso:      %-36s ║\n", round($totalSucesso / $totalReqs * 100, 1) . "% ($totalSucesso/$totalReqs)");
echo "╠══════════════════════════════════════════════════════════════╣\n";
echo "║  TEMPO POR ETAPA                                          ║\n";
echo "╠══════════════════════════════════════════════════════════════╣\n";

$etapas = [
    'cadastro' => ['Cadastro pacientes', $metricas['cadastro_pacientes']],
    'checkin' => ['Check-in na fila', $metricas['checkin_fila']],
    'acuidade' => ['Acuidade visual', $metricas['acuidade']],
    'exames' => ['Exames', $metricas['exames']],
    'laudos' => ['Laudos', $metricas['laudos']],
    'prescricoes' => ['Prescrições', $metricas['prescricoes']],
    'consulta_prontuario' => ['Consulta prontuário', $metricas['consulta_prontuario']],
];

foreach ($etapas as $key => $info) {
    $nome = $info[0];
    $dados = $info[1];
    $total = $dados['sucesso'] + $dados['erro'];
    $media = $total > 0 ? round($dados['tempo_total'] / $total * 1000) : 0;
    $tempoEtapa = round($dados['tempo_total'], 1);
    printf("║  %-22s %3d/%3d OK  Média: %4dms  Total: %5ss ║\n", 
        $nome, $dados['sucesso'], $total, $media, $tempoEtapa);
}

echo "╠══════════════════════════════════════════════════════════════╣\n";
echo "║  DISTRIBUIÇÃO DE CONDUTAS                                  ║\n";
echo "╠══════════════════════════════════════════════════════════════╣\n";
printf("║  Alta direta:          %-36s ║\n", $metricas['condutas']['alta'] . " (" . round($metricas['condutas']['alta'] / $TOTAL_ALUNOS * 100) . "%)");
printf("║  Encaminhamento:       %-36s ║\n", $metricas['condutas']['encaminhamento'] . " (" . round($metricas['condutas']['encaminhamento'] / $TOTAL_ALUNOS * 100) . "%)");
printf("║  Óculos (alta):        %-36s ║\n", $metricas['condutas']['onibus'] . " (" . round($metricas['condutas']['onibus'] / $TOTAL_ALUNOS * 100) . "%)");
printf("║  Óculos (encaminh.):   %-36s ║\n", $metricas['condutas']['onibus_encaminhamento'] . " (" . round($metricas['condutas']['onibus_encaminhamento'] / $TOTAL_ALUNOS * 100) . "%)");
echo "╠══════════════════════════════════════════════════════════════╣\n";
echo "║  AVALIAÇÃO DE PERFORMANCE                                  ║\n";
echo "╠══════════════════════════════════════════════════════════════╣\n";

// Avaliar performance
$reqsPorSeg = $totalReqs / $tempoTotal;
$mediaGeral = $tempoTotal / $totalReqs * 1000;

if ($totalErro === 0 && $mediaGeral < 200) {
    echo "║  🟢 EXCELENTE - Sistema suporta a carga sem problemas     ║\n";
} elseif ($totalErro < $totalReqs * 0.01 && $mediaGeral < 500) {
    echo "║  🟢 BOM - Sistema suporta a carga com performance aceitável║\n";
} elseif ($totalErro < $totalReqs * 0.05 && $mediaGeral < 1000) {
    echo "║  🟡 REGULAR - Algumas lentidões detectadas                ║\n";
} elseif ($totalErro < $totalReqs * 0.1) {
    echo "║  🟠 ATENÇÃO - Erros e lentidões significativos            ║\n";
} else {
    echo "║  🔴 CRÍTICO - Sistema não suporta esta carga              ║\n";
}

printf("║  Tempo médio por req:  %-36s ║\n", round($mediaGeral) . "ms");
printf("║  Erros totais:         %-36s ║\n", $totalErro);
echo "╚══════════════════════════════════════════════════════════════╝\n";

// Erros detalhados
if (!empty($metricas['erros_detalhados'])) {
    echo "\n⚠️  Primeiros erros encontrados:\n";
    foreach ($metricas['erros_detalhados'] as $err) {
        echo "   - $err\n";
    }
}

// LIMPEZA: Deletar pacientes de teste
echo "\n🧹 Limpando dados de teste...\n";
$res = request('DELETE', "$BASE_URL/pacientes/escola", ['escola' => $ESCOLA], $token);
if ($res['status'] === 200) {
    echo "   ✅ Dados de teste removidos com sucesso\n";
} else {
    echo "   ⚠️  Limpeza manual necessária (escola: $ESCOLA)\n";
}

echo "\n✅ Teste de carga finalizado!\n\n";
