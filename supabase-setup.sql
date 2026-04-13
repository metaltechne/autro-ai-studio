-- Script SQL para criar todas as tabelas do Autro AI Studio
-- Execute este código no SQL Editor do Supabase

-- Criar tabela principal (armazena tudo como JSON)
CREATE TABLE IF NOT EXISTS app_data (
    id TEXT PRIMARY KEY DEFAULT 'main',
    seeded BOOLEAN DEFAULT false,
    components JSONB DEFAULT '[]'::jsonb,
    kits JSONB DEFAULT '[]'::jsonb,
    inventoryLogs JSONB DEFAULT '[]'::jsonb,
    familias JSONB DEFAULT '[]'::jsonb,
    purchaseOrders JSONB DEFAULT '[]'::jsonb,
    poCounter INTEGER DEFAULT 1,
    productionOrders JSONB DEFAULT '[]'::jsonb,
    prodCounter INTEGER DEFAULT 1,
    manufacturingOrders JSONB DEFAULT '[]'::jsonb,
    moCounter INTEGER DEFAULT 1,
    cuttingOrders JSONB DEFAULT '[]'::jsonb,
    coCounter INTEGER DEFAULT 1,
    financialSettings JSONB DEFAULT '{}'::jsonb,
    userRoles JSONB DEFAULT '[]'::jsonb,
    rolePermissions JSONB DEFAULT '[]'::jsonb,
    promotionalCampaigns JSONB DEFAULT '[]'::jsonb,
    activityLogs JSONB DEFAULT '[]'::jsonb,
    customers JSONB DEFAULT '[]'::jsonb,
    workStations JSONB DEFAULT '[]'::jsonb,
    consumables JSONB DEFAULT '[]'::jsonb,
    standardOperations JSONB DEFAULT '[]'::jsonb,
    financialTransactions JSONB DEFAULT '[]'::jsonb,
    financialAccounts JSONB DEFAULT '[]'::jsonb,
    financialCategories JSONB DEFAULT '[]'::jsonb,
    receivingOrders JSONB DEFAULT '[]'::jsonb,
    supplierProductMappings JSONB DEFAULT '[]'::jsonb,
    receivingCounter INTEGER DEFAULT 1,
    tasks JSONB DEFAULT '[]'::jsonb,
    lastModified BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE app_data ENABLE ROW LEVEL SECURITY;

-- Política de leitura (qualquer usuário autenticado)
CREATE POLICY "Allow read" ON app_data FOR SELECT USING (true);

-- Política de atualização (qualquer usuário autenticado)
CREATE POLICY "Allow update" ON app_data FOR UPDATE USING (true);

-- Política de insert (qualquer usuário autenticado)
CREATE POLICY "Allow insert" ON app_data FOR INSERT WITH CHECK (true);

-- Inserir registro inicial
INSERT INTO app_data (id, seeded) VALUES ('main', false) ON CONFLICT (id) DO NOTHING;

-- Tabela de usuários (para auth)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Allow all on users" ON public.users FOR ALL USING (true) WITH CHECK (true);

-- Criar usuário admin inicial (mude o email)
-- INSERT INTO public.users (email, role) VALUES ('antonio.marcos@autro.com.br', 'Admin') ON CONFLICT (email) DO NOTHING;

SELECT * FROM app_data WHERE id = 'main';