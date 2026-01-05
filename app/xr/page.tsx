import dynamic from 'next/dynamic'
import { XrPageClient } from './XRPageClient'
//dynamically import the XrPageClient component using dynamic
export default function XrPage() {
    return <XrPageClient />
}