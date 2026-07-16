import { useEffect, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Search, UserPlus, Loader2 } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

interface UsuarioHub {
  user_id: string
  nome: string
  email: string
  role: string
}

interface Props {
  open: boolean
  modulo: string
  jaCadastrados: Set<string>
  onClose: () => void
  onAdicionado: () => void
}

export function AdicionarDestinatarioModal({
  open, modulo, jaCadastrados, onClose, onAdicionado,
}: Props) {
  const [busca, setBusca] = useState('')
  const [adicionandoId, setAdicionandoId] = useState<string | null>(null)

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['usuarios-hub-add-dest', busca],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('rpc_buscar_usuarios_hub' as never, {
        p_busca: busca || null,
      } as never)
      if (error) throw error
      return (data ?? []) as unknown as UsuarioHub[]
    },
    enabled: open,
  })

  useEffect(() => { if (!open) setBusca('') }, [open])

  const handleAdd = async (u: UsuarioHub) => {
    setAdicionandoId(u.user_id)
    try {
      const { error } = await supabase.rpc('rpc_adicionar_destinatario_automatico' as never, {
        p_user_id: u.user_id,
        p_modulo: modulo,
      } as never)
      if (error) throw error
      toast.success(`${u.nome} adicionado(a) à lista`)
      onAdicionado()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao adicionar')
    } finally {
      setAdicionandoId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Adicionar destinatário
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou e-mail..."
              className="pl-9"
              autoFocus
            />
          </div>

          <ScrollArea className="h-80 rounded-md border">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : usuarios.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                Nenhum usuário encontrado
              </div>
            ) : (
              <div className="p-1">
                {usuarios.map((u) => {
                  const jaTem = jaCadastrados.has(u.user_id)
                  const isAdicionando = adicionandoId === u.user_id
                  return (
                    <div
                      key={u.user_id}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-muted"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{u.nome}</span>
                          {u.role && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
                              {u.role}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      <Button
                        size="sm"
                        variant={jaTem ? 'outline' : 'default'}
                        disabled={jaTem || isAdicionando}
                        onClick={() => handleAdd(u)}
                      >
                        {isAdicionando ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : jaTem ? 'Já cadastrado' : 'Adicionar'}
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
