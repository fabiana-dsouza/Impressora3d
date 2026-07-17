"use client";

import { useEffect, useState } from "react";
import TopoTela from "@/components/TopoTela";
import Dialogo from "@/components/Dialogo";
import {
  IconeCaixa,
  IconeCheck,
  IconeEngrenagem,
  IconeEscudo,
  IconeImpressora,
  IconeMoeda,
  IconeRaio,
  IconeSair,
  IconeUsuario,
} from "@/components/Icones";
import {
  lerConfig,
  salvarConfig,
  emailUsuario,
  sair,
  lerAssinatura,
  cancelarAssinatura,
  type Assinatura,
} from "@/lib/db";
import { CONFIG_PADRAO, MARGEM_MINIMA } from "@/lib/defaults";
import { custoEnergiaPorHora, desgastePorHora } from "@/lib/calc";
import { brl } from "@/lib/format";
import type { Config } from "@/lib/types";

export default function Configuracoes() {
  const [cfg, setCfg] = useState<Config>(CONFIG_PADRAO);
  const [salvo, setSalvo] = useState(false);
  const [email, setEmail] = useState("");
  const [saindo, setSaindo] = useState(false);
  const [aviso, setAviso] = useState("");
  const [perguntandoRestaurar, setPerguntandoRestaurar] = useState(false);
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  const [perguntandoCancelar, setPerguntandoCancelar] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [c, em] = await Promise.all([lerConfig(), emailUsuario()]);
        if (!vivo) return;
        setCfg(c);
        setEmail(em);
      } catch (e) {
        console.error(e);
      }
    })();
    lerAssinatura()
      .then((a) => vivo && setAssinatura(a))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  function set<K extends keyof Config>(chave: K, valor: number) {
    setCfg((c) => ({ ...c, [chave]: valor }));
    setSalvo(false);
  }

  async function salvar() {
    // Trava rígida: a margem sugerida nunca pode ficar abaixo de 15%.
    const limpa: Config = {
      ...cfg,
      margemPadrao: Math.max(MARGEM_MINIMA, cfg.margemPadrao),
    };
    setCfg(limpa);
    try {
      await salvarConfig(limpa);
      setSalvo(true);
    } catch (e) {
      console.error(e);
      setAviso("Tenta de novo daqui a pouquinho!");
    }
  }

  async function restaurar() {
    setCfg(CONFIG_PADRAO);
    try {
      await salvarConfig(CONFIG_PADRAO);
      setSalvo(true);
    } catch (e) {
      console.error(e);
      setAviso("Tenta de novo daqui a pouquinho!");
    }
  }

  async function sairDaConta() {
    setSaindo(true);
    try {
      await sair();
      window.location.href = "/"; // sai pra entrada do site, não pro formulário
    } catch (e) {
      console.error(e);
      setSaindo(false);
    }
  }

  async function cancelarAgora() {
    setPerguntandoCancelar(false);
    setCancelando(true);
    try {
      await cancelarAssinatura();
      const a = await lerAssinatura();
      setAssinatura(a);
    } catch (e) {
      console.error(e);
      setAviso(
        "Não consegui cancelar agora. Tenta de novo daqui a pouco ou fala com um adulto."
      );
    } finally {
      setCancelando(false);
    }
  }

  // Só faz sentido cancelar uma assinatura paga que ainda está valendo (a
  // cortesia da família não tem plano; a já cancelada não tem o que cancelar).
  const podeCancelar =
    !!assinatura?.plano &&
    (assinatura.status === "ativa" || assinatura.status === "atrasada");
  const valeAte =
    assinatura?.pagoAte != null
      ? new Date(assinatura.pagoAte).toLocaleDateString("pt-BR")
      : null;

  const energiaHora = custoEnergiaPorHora(cfg.potenciaWatts, cfg.tarifaKwh);
  const desgasteHora = desgastePorHora(cfg.precoImpressora, cfg.vidaUtilHoras);

  return (
    <main className="mx-auto w-full max-w-xl">
      <TopoTela
        titulo="Configurações"
        icone={<IconeEngrenagem size={22} />}
        voltarPara="/"
      />

      <p className="mb-5 font-bold text-mute">
        São os segredinhos da conta. Se não entender, pode deixar como está!
      </p>

      {/* Energia */}
      <Bloco titulo="Conta de luz" icone={<IconeRaio size={20} />}>
        <Campo
          rotulo="Força da impressora (watts)"
          ajuda="Quanta luz a impressora usa. A A1 usa mais ou menos 100."
          valor={cfg.potenciaWatts}
          onChange={(v) => set("potenciaWatts", v)}
          sufixo="W"
        />
        <Campo
          rotulo="Preço da luz (por kWh)"
          ajuda="Está escrito na conta de luz da sua casa."
          valor={cfg.tarifaKwh}
          onChange={(v) => set("tarifaKwh", v)}
          prefixo="R$"
          decimal
        />
        <Resultado texto="Cada hora de impressão gasta de luz:" valor={energiaHora} />
      </Bloco>

      {/* Desgaste */}
      <Bloco titulo="Desgaste da impressora" icone={<IconeImpressora size={20} />}>
        <p className="mb-3 rounded-2xl border border-ciano/30 bg-ciano/10 p-3 font-bold text-ciano">
          Desgaste = um dinheirinho guardado pra trocar a impressora quando ela
          cansar.
        </p>
        <Campo
          rotulo="Quanto custou a impressora"
          ajuda="O preço que você pagou nela."
          valor={cfg.precoImpressora}
          onChange={(v) => set("precoImpressora", v)}
          prefixo="R$"
        />
        <Campo
          rotulo="Quantas horas ela aguenta"
          ajuda="Mais ou menos quantas horas ela vai imprimir na vida toda."
          valor={cfg.vidaUtilHoras}
          onChange={(v) => set("vidaUtilHoras", v)}
          sufixo="h"
        />
        <Resultado
          texto="Cada hora de impressão gasta de desgaste:"
          valor={desgasteHora}
        />
      </Bloco>

      {/* Embalagem */}
      <Bloco titulo="Embalagem" icone={<IconeCaixa size={20} />}>
        <p className="mb-3 rounded-2xl border border-ciano/30 bg-ciano/10 p-3 font-bold text-ciano">
          Todo produto vai numa embalagem bonita. Esse valor entra sozinho em
          toda continha!
        </p>
        <Campo
          rotulo="Quanto custa a embalagem"
          ajuda="Saquinho, caixinha, plástico bolha..."
          valor={cfg.custoEmbalagem}
          onChange={(v) => set("custoEmbalagem", v)}
          prefixo="R$"
          decimal
        />
      </Bloco>

      {/* Falhas */}
      <Bloco
        titulo="Reserva pra quando dá errado"
        icone={<IconeEscudo size={20} />}
      >
        <p className="mb-3 rounded-2xl border border-grana-amarelo/30 bg-grana-amarelo/10 p-3 font-bold text-grana-amarelo">
          Às vezes a peça sai torta e vai pro lixo. Essa reservinha cobre esses
          errinhos!
        </p>
        <CampoPct
          rotulo="Quanto guardar pra falhas"
          valor={cfg.taxaFalhas}
          onChange={(v) => set("taxaFalhas", v)}
        />
      </Bloco>

      {/* Margem padrão */}
      <Bloco titulo="Meu ganho sugerido" icone={<IconeMoeda size={20} />}>
        <p className="mb-3 rounded-2xl border border-neon/30 bg-neon/10 p-3 font-bold text-neon">
          É o quanto você quer ganhar em cima do custo. O mínimo é sempre 15%
          pra você não sair no prejuízo!
        </p>
        <CampoPct
          rotulo="Ganho que já vem escolhido"
          valor={cfg.margemPadrao}
          min={MARGEM_MINIMA}
          max={3}
          onChange={(v) => set("margemPadrao", v)}
        />
      </Bloco>

      {/* Ações */}
      <button
        onClick={salvar}
        className="btn-grande btn-neon mt-2 flex w-full items-center justify-center gap-2 text-2xl"
      >
        {salvo ? (
          <>
            <IconeCheck size={24} /> Salvo!
          </>
        ) : (
          "Salvar tudo"
        )}
      </button>
      <button
        onClick={() => setPerguntandoRestaurar(true)}
        className="mt-3 w-full rounded-2xl py-3 font-extrabold text-mute underline"
      >
        Voltar pro jeitinho de fábrica
      </button>

      {/* Conta */}
      <section className="card mt-6">
        <h2 className="display mb-2 flex items-center gap-2 text-xl font-bold text-tinta">
          <IconeUsuario size={20} className="text-ciano" />
          Minha conta
        </h2>
        <p className="mb-3 font-bold text-mute">
          Você entrou como{" "}
          <span className="text-tinta">{email || "..."}</span>
        </p>
        <div className="mb-4 rounded-xl border border-borda bg-painel2 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="font-bold text-mute">
              Assinatura:{" "}
              <span className={assinatura?.ativa ? "text-neon" : "text-perigo"}>
                {assinatura === null
                  ? "..."
                  : assinatura.status === "cancelada" && assinatura.ativa
                  ? "cancelada"
                  : assinatura.ativa
                  ? `ativa${assinatura.plano ? ` (${assinatura.plano})` : ""}`
                  : assinatura.status}
              </span>
            </span>
            {!assinatura?.ativa && (
              <a
                href="/planos"
                className="shrink-0 text-sm font-bold text-ciano underline"
              >
                ver planos
              </a>
            )}
          </div>

          {/* Data: "renova em" pra assinatura viva, "vale até" pra cancelada */}
          {valeAte && assinatura?.ativa && (
            <p className="mt-1 text-sm font-bold text-mute">
              {assinatura.status === "cancelada"
                ? `Cobranças paradas. Você usa até ${valeAte}.`
                : `Próxima cobrança em ${valeAte}.`}
            </p>
          )}

          {podeCancelar && (
            <button
              onClick={() => setPerguntandoCancelar(true)}
              disabled={cancelando}
              className="mt-3 text-sm font-bold text-perigo underline disabled:opacity-60"
            >
              {cancelando ? "Cancelando..." : "Cancelar assinatura"}
            </button>
          )}
        </div>
        <button
          onClick={sairDaConta}
          disabled={saindo}
          className="btn-grande btn-escuro flex w-full items-center justify-center gap-2 disabled:opacity-60"
        >
          {saindo ? (
            "Saindo..."
          ) : (
            <>
              <IconeSair size={20} /> Sair da conta
            </>
          )}
        </button>
      </section>

      {perguntandoRestaurar && (
        <Dialogo
          icone={<IconeEngrenagem size={26} />}
          titulo="Voltar tudo pro jeitinho de fábrica?"
          texto="Os segredinhos voltam pro valor que já vinha pronto. Seus produtos e cores não mudam."
          confirmar="Pode voltar"
          cancelar="Deixa como está"
          onConfirmar={restaurar}
          onFechar={() => setPerguntandoRestaurar(false)}
        />
      )}

      {perguntandoCancelar && (
        <Dialogo
          tom="perigo"
          titulo="Cancelar a assinatura?"
          texto={
            valeAte
              ? `As cobranças param. Você continua usando a fábrica até ${valeAte}, e seus produtos e cores ficam guardados. Depois, é só assinar de novo pra voltar.`
              : "As cobranças param e você para de usar a fábrica. Seus produtos e cores ficam guardados pra quando você voltar."
          }
          confirmar="Sim, cancelar"
          cancelar="Deixa como está"
          onConfirmar={cancelarAgora}
          onFechar={() => setPerguntandoCancelar(false)}
        />
      )}

      {aviso && (
        <Dialogo
          tom="perigo"
          titulo="Não consegui salvar"
          texto={aviso}
          onFechar={() => setAviso("")}
        />
      )}
    </main>
  );
}

function Bloco({
  titulo,
  icone,
  children,
}: {
  titulo: string;
  icone?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card mb-4">
      <h2 className="display mb-3 flex items-center gap-2 text-xl font-bold text-tinta">
        {icone && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-borda bg-painel2 text-ciano">
            {icone}
          </span>
        )}
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Campo({
  rotulo,
  ajuda,
  valor,
  onChange,
  prefixo,
  sufixo,
  decimal,
}: {
  rotulo: string;
  ajuda?: string;
  valor: number;
  onChange: (v: number) => void;
  prefixo?: string;
  sufixo?: string;
  decimal?: boolean;
}) {
  return (
    <label className="mb-4 block">
      <span className="block font-extrabold text-tinta">{rotulo}</span>
      {ajuda && (
        <span className="mb-1.5 block text-sm font-bold text-mute">{ajuda}</span>
      )}
      {/* prefixo e sufixo moram dentro da moldura: fora dela eles roubavam
          largura do campo e empurravam o número pra fora em tela pequena */}
      <span className="flex items-center gap-2 rounded-2xl border-2 border-borda bg-painel2 px-3 focus-within:border-neon">
        {prefixo && (
          <span className="shrink-0 font-extrabold text-mute">{prefixo}</span>
        )}
        <input
          type="number"
          inputMode="decimal"
          step={decimal ? "0.01" : "1"}
          value={valor}
          onChange={(e) => onChange(Number(e.target.value))}
          className="valor w-full min-w-0 bg-transparent py-3 text-lg font-bold text-tinta outline-none"
        />
        {sufixo && (
          <span className="shrink-0 font-extrabold text-mute">{sufixo}</span>
        )}
      </span>
    </label>
  );
}

/** Campo que mostra % pra criança mas guarda fração (0-1 ou mais). */
function CampoPct({
  rotulo,
  valor,
  onChange,
  min = 0,
  max = 1,
}: {
  rotulo: string;
  valor: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  const pct = Math.round(valor * 100);
  return (
    <div className="mb-2">
      <label className="mb-1 flex items-center justify-between gap-3 font-extrabold text-tinta">
        <span className="min-w-0">{rotulo}</span>
        <span className="display shrink-0 text-neon">{pct}%</span>
      </label>
      <input
        type="range"
        min={Math.round(min * 100)}
        max={Math.round(max * 100)}
        step={5}
        value={pct}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="h-4 w-full cursor-pointer appearance-none rounded-full bg-painel2 accent-neon"
      />
    </div>
  );
}

function Resultado({ texto, valor }: { texto: string; valor: number }) {
  return (
    <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-borda bg-painel2 p-3">
      <span className="min-w-0 font-bold text-mute">{texto}</span>
      <span className="valor shrink-0 text-lg font-bold text-neon">
        {brl(valor)}
      </span>
    </div>
  );
}
