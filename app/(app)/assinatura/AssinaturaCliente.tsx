"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAssinatura } from "@/hooks/useAssinatura";
import {
  ANUAL_EM_MESES, NIVEIS, NOME_DO_NIVEL, PERIODOS, formatarPreco, precoEmCentavos, type NivelAssinatura, type Periodo,
} from "@/lib/assinatura/catalogo";
import { economiaDoAnualPercentual, mensalEquivalenteEmCentavos, recursosNovosDoNivel, resumoDoEstado, rotuloDoBotao } from "@/lib/assinatura/apresentacao";
import { temAcesso } from "@/lib/assinatura/regras";
import { aoTeclarNoGrupo } from "@/lib/teclado";
import estilos from "./assinatura.module.css";

const NOME_DO_PERIODO: Record<Periodo, string> = { mensal: "Mensal", anual: "Anual" };

/** Chama uma rota de assinatura e devolve o endereço para onde levar a pessoa (ou a mensagem de erro). */
async function pedirEndereco(rota: string, corpo?: unknown): Promise<{ url: string } | { erro: string }> {
  try {
    const r = await fetch(rota, {
      method: "POST",
      credentials: "same-origin",
      headers: corpo ? { "Content-Type": "application/json" } : undefined,
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const json = (await r.json().catch(() => null)) as { url?: string; erro?: string } | null;
    if (r.ok && json?.url) return { url: json.url };
    return { erro: json?.erro ?? "Não foi possível continuar. Tente novamente." };
  } catch {
    return { erro: "Sem conexão. Verifique a internet e tente de novo." };
  }
}

export default function AssinaturaCliente() {
  const { estado, pronto, fase, atualizar } = useAssinatura();
  const router = useRouter();
  const consulta = useSearchParams();
  const retorno = consulta.get("checkout");

  const [periodo, setPeriodo] = useState<Periodo>("mensal");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<"confirmando" | "confirmado" | "demorando" | null>(null);
  const jaTratouRetorno = useRef(false);

  // Ao abrir esta tela, consulta o Stripe de verdade (a pessoa pode ter acabado de pagar ou de usar o portal).
  useEffect(() => {
    const id = setTimeout(() => void atualizar(true), 0);
    return () => clearTimeout(id);
  }, [atualizar]);

  // Voltando do pagamento: o Stripe pode levar alguns segundos para refletir. Pergunta até aparecer.
  useEffect(() => {
    if (retorno !== "ok" || jaTratouRetorno.current) return;
    jaTratouRetorno.current = true;
    let cancelado = false;
    const esperar = async () => {
      setResultado("confirmando");
      let confirmou = false;
      for (let tentativa = 0; tentativa < 6 && !cancelado; tentativa++) {
        const novo = await atualizar(true);
        if (novo && temAcesso(novo)) { confirmou = true; break; }
        await new Promise(r => setTimeout(r, 2000));
      }
      if (!cancelado) {
        setResultado(confirmou ? "confirmado" : "demorando");
        router.replace("/assinatura"); // tira ?checkout=ok do endereço; a mensagem fica, porque vem do estado
      }
    };
    void esperar();
    return () => { cancelado = true; };
  }, [retorno, atualizar, router]);

  const resumo = resumoDoEstado(estado);
  const gerenciavel = estado.situacao === "teste" || estado.situacao === "ativa" || estado.situacao === "atrasada" || estado.situacao === "cancelada";

  const ir = async (id: string, rota: string, corpo?: unknown) => {
    setErro(null);
    setOcupado(id);
    const r = await pedirEndereco(rota, corpo);
    if ("url" in r) {
      window.location.assign(r.url);
      return; // a página vai ser trocada: mantém o botão ocupado
    }
    setErro(r.erro);
    setOcupado(null);
  };

  const aoClicar = (nivel: NivelAssinatura) => {
    const { acao } = rotuloDoBotao(estado, nivel);
    if (acao === "assinar") void ir(nivel, "/api/assinatura/checkout", { nivel, periodo });
    else if (acao === "portal") void ir("portal", "/api/assinatura/portal");
  };

  if (!pronto) {
    return <main className="page-container" aria-busy="true"><div className="skeleton" /></main>;
  }

  return (
    <main className="page-container">
      <header>
        <Link href="/perfil" className="link-muted"><i className="ph-bold ph-caret-left" aria-hidden="true" /> Voltar</Link>
        <p className="eyebrow mt-18">Sua conta</p>
        <h1 className="page-title">Assinatura</h1>
        <p className="muted-copy">Escolha o plano que acompanha o seu treino. Cancele quando quiser.</p>
      </header>

      <div role="status" aria-live="polite">
        {resultado === "confirmando" && <p className={estilos.mensagem}>Pagamento recebido. Estamos confirmando a sua assinatura…</p>}
        {resultado === "confirmado" && <p className={estilos.mensagem}>Tudo certo! Sua assinatura está confirmada.</p>}
        {resultado === "demorando" && <p className={estilos.mensagem}>Recebemos o seu pagamento, mas a confirmação está demorando. Atualize esta página em instantes.</p>}
        {retorno === "cancelado" && <p className={estilos.mensagem}>Você saiu do pagamento sem concluir. Nada foi cobrado.</p>}
      </div>

      {fase === "indisponivel" ? (
        <section className={`surface-card ${estilos.resumo}`}>
          <p className={estilos.resumoTitulo}>Pagamento ainda não disponível</p>
          <p className={estilos.resumoDetalhe}>Neste ambiente o pagamento não está ligado, então todos os recursos do Corner estão liberados. Os planos abaixo mostram como será a cobrança.</p>
        </section>
      ) : (
        <section className={`surface-card ${estilos.resumo} ${resumo.tom === "destaque" ? estilos.resumoDestaque : resumo.tom === "alerta" ? estilos.resumoAlerta : ""}`} aria-label="Sua assinatura">
          <p className={estilos.resumoTitulo}>{resumo.titulo}</p>
          <p className={estilos.resumoDetalhe}>{resumo.detalhe}</p>
          {gerenciavel && (
            <button type="button" className={`btn-ghost ${estilos.resumoAcao}`} disabled={ocupado !== null} onClick={() => void ir("portal", "/api/assinatura/portal")}>
              {ocupado === "portal" ? "Abrindo…" : "Gerenciar assinatura"}
            </button>
          )}
        </section>
      )}

      {erro && <p role="alert" className={estilos.erro}>{erro}</p>}

      <div className={estilos.periodo}>
        <div className="seg" role="radiogroup" aria-label="Período da cobrança" onKeyDown={e => aoTeclarNoGrupo(e, "radio")}>
          {PERIODOS.map(p => (
            <button key={p} type="button" role="radio" aria-checked={periodo === p} tabIndex={periodo === p ? 0 : -1} className={periodo === p ? "ativo" : ""} onClick={() => setPeriodo(p)}>
              {NOME_DO_PERIODO[p]}
            </button>
          ))}
        </div>
        <p className={estilos.periodoDica}>No plano anual você paga {ANUAL_EM_MESES} meses e usa 12 (economia de {economiaDoAnualPercentual()}%).</p>
      </div>

      <div className={estilos.planos}>
        {NIVEIS.map((nivel, i) => {
          const atual = (estado.situacao === "ativa" || estado.situacao === "teste") && estado.nivel === nivel;
          const botao = rotuloDoBotao(estado, nivel);
          const anterior = i > 0 ? NOME_DO_NIVEL[NIVEIS[i - 1]] : null;
          return (
            <article key={nivel} className={`surface-card ${estilos.plano} ${atual ? estilos.planoAtual : ""}`} aria-label={`Plano ${NOME_DO_NIVEL[nivel]}`}>
              <div className={estilos.planoTopo}>
                <h2 className={estilos.planoNome}>{NOME_DO_NIVEL[nivel]}</h2>
                {periodo === "anual" && <span className={estilos.etiqueta}>{economiaDoAnualPercentual()}% de economia</span>}
              </div>
              <p className={estilos.preco}>
                <strong className={estilos.precoValor}>{formatarPreco(precoEmCentavos(nivel, periodo))}</strong>
                <span className={estilos.precoPeriodo}>{periodo === "mensal" ? "por mês" : "por ano"}</span>
                {periodo === "anual" && <span className={estilos.precoNota}>equivale a {formatarPreco(mensalEquivalenteEmCentavos(nivel))} por mês</span>}
              </p>
              <ul className={estilos.recursos}>
                <li className={estilos.base}>{anterior ? `Tudo do ${anterior}` : "Tudo do plano gratuito"}</li>
                {recursosNovosDoNivel(nivel).map(nome => <li key={nome}>{nome}</li>)}
              </ul>
              <button
                type="button"
                className={botao.acao === "assinar" ? "btn-primary" : "btn-ghost"}
                disabled={botao.acao === "nenhuma" || ocupado !== null || fase === "indisponivel"}
                aria-label={`${botao.texto}: plano ${NOME_DO_NIVEL[nivel]}`}
                onClick={() => aoClicar(nivel)}
              >
                {ocupado === nivel ? "Abrindo o pagamento…" : botao.texto}
              </button>
            </article>
          );
        })}
      </div>

      <section className={`surface-card ${estilos.gratuito}`} aria-label="Plano gratuito">
        <h2>Plano gratuito</h2>
        <ul className={`${estilos.recursos} mt-10`}>
          {recursosNovosDoNivel("gratuito").map(nome => <li key={nome}>{nome}</li>)}
        </ul>
      </section>

      <p className={estilos.rodape}>Pagamento processado com segurança pelo Stripe. O teste grátis de 7 dias não pede cartão.</p>
    </main>
  );
}
