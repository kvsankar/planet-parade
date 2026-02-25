import { createContext, useContext } from 'react'
import { SelectionState } from '../types'

export const SelectionContext = createContext<SelectionState>({
  selectedBodyId: null,
  followMode: false,
  selectBody: () => {},
  toggleFollow: () => {},
})

export function useSelection() {
  return useContext(SelectionContext)
}
