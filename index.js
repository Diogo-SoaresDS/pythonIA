const bodyParser = require('body-parser');
const express = require('express');
const app = express();
const path = require('path');
require('dotenv').config();

const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/praticar', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'praticar.html'));
});

app.get('/perguntas', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'perguntas.html'));
});

app.post('/chat', async (req, res) => {
    const question = req.body.question;

    if (!question) {
        return res.status(400).json({ error: 'Pergunta não pode estar vazia!' });
    }

    const pythonKeywords = ['python', 'PYTHON', 'Py', 'programação', 'código', 'função', 'módulo', 'biblioteca', 'sintaxe', 'erro', 'debug'];
    if (!pythonKeywords.some(keyword => question.includes(keyword))) {
        return res.status(400).json({ error: 'Por favor, faça perguntas relacionadas a Python.' });
    }

    try {
        const apiResponse = await model.generateContent(question);
        const answer = apiResponse.response.candidates[0].content.parts[0].text;

        const summaryResponse = await model.generateContent(`Resuma no máximo em um parágrafo: ${answer}`);
        const summary = summaryResponse.response.candidates[0].content.parts[0].text;

        return res.json({ response: summary });
    } catch (error) {
        console.error('Erro ao processar a solicitação:', error);
        return res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});

app.post('/perguntas', async (req, res) => {
    const nivel = req.query.nivel;
    const quantidade = req.query.quantidade;

    // Validação do nível
    const niveisValidos = ['facil', 'medio', 'dificil'];
    if (!niveisValidos.includes(nivel)) {
        return res.status(400).json({ error: 'Nível inválido. Escolha entre: facil, medio, ou dificil.' });
    }

    // Validação da quantidade
    if (!quantidade || isNaN(quantidade) || parseInt(quantidade) <= 0) {
        return res.status(400).json({ error: 'Quantidade deve ser um número inteiro positivo.' });
    }

    try {
        const perguntasGeradas = await gerar_perguntas(nivel, parseInt(quantidade));
        return res.status(200).json({ perguntas: perguntasGeradas });
    } catch (error) {
        console.error('Erro ao gerar perguntas:', error);
        return res.status(500).json({ error: 'Erro interno ao gerar perguntas.' });
    }
})

async function gerar_perguntas(nivel, quantidade) {
    const prompts = {
        'facil': `Gere um JSON com as seguintes chaves: (pergunta, opcoes, resposta) com ${quantidade} perguntas fáceis sobre Python, cada uma contendo 4 opções de resposta e a resposta correta.`,
        'medio': `Gere um JSON com as seguintes chaves: (pergunta, opcoes, resposta) com ${quantidade} perguntas de dificuldade média sobre Python, cada uma contendo 4 opções de resposta e a resposta correta.`,
        'dificil': `Gere um JSON com as seguintes chaves: (pergunta, opcoes, resposta) com ${quantidade} perguntas difíceis sobre Python, cada uma contendo 4 opções de resposta e a resposta correta.`
    };

    const apiResponse = await model.generateContent(prompts[nivel]);

    const perguntasTexto = apiResponse.response.candidates[0].content.parts[0].text;
    const cleanedText = perguntasTexto
        .replace(/```json|```/g, '')
        .trim();

    try {
        const perguntasJson = JSON.parse(cleanedText);
        return perguntasJson;
    } catch (error) {
        console.error('Erro ao converter texto para JSON:', error);
        return [];
    }
}

app.post('/enviar_respostas', async (req, res) => {
    const { answers, correctAnswers } = req.body;

    if (!answers || !correctAnswers) {
        return res.status(400).json({ error: 'Respostas não podem estar vazias.' });
    }

    let acertos = 0;
    let erros = 0;
    const resultados = {};

    Object.keys(answers).forEach((key) => {
        if (answers[key] === correctAnswers[key]) {
            acertos++;
        } else {
            erros++;
            resultados[key] = {
                respostaDada: answers[key],
                respostaCorreta: correctAnswers[key],
            };
        }
    });

    return res.json({ acertos, erros, resultados });
});

app.listen(3000, () => {
    console.log('Server rodando na porta 3000.');
});
