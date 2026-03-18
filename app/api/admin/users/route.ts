import { NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import { getTenantFromRequest, isTenantError } from '@/lib/api-tenant-helper'
import { auth } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'

// GET — list organization members
export async function GET(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request)
    if (isTenantError(ctx)) return ctx
    const { config } = ctx

    const orgId = config.clerkOrgId
    if (!orgId) return NextResponse.json({ error: 'No organization configured' }, { status: 400 })

    const clerk = await clerkClient()
    const memberships = await clerk.organizations.getOrganizationMembershipList({
      organizationId: orgId,
      limit: 100,
    })

    const members = memberships.data.map((m: any) => ({
      id: m.publicUserData?.userId || m.id,
      membershipId: m.id,
      firstName: m.publicUserData?.firstName || '',
      lastName: m.publicUserData?.lastName || '',
      email: m.publicUserData?.identifier || '',
      imageUrl: m.publicUserData?.imageUrl || '',
      role: m.role,
      createdAt: m.createdAt,
    }))

    return NextResponse.json({ members })
  } catch (error: any) {
    console.error('GET admin/users error:', error)
    return NextResponse.json({ error: error?.message || 'Failed' }, { status: 500 })
  }
}

// POST — create a new user with username+password and add to org
export async function POST(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request)
    if (isTenantError(ctx)) return ctx
    const { config } = ctx

    const orgId = config.clerkOrgId
    if (!orgId) return NextResponse.json({ error: 'No organization configured' }, { status: 400 })

    const body = await request.json()
    const { username, password, firstName, lastName, role } = body
    if (!username || !password) return NextResponse.json({ error: 'שם משתמש וסיסמה נדרשים' }, { status: 400 })
    if (password.length < 8) return NextResponse.json({ error: 'סיסמה חייבת להכיל לפחות 8 תווים' }, { status: 400 })

    const clerk = await clerkClient()

    // Create the user
    const user = await clerk.users.createUser({
      username,
      password,
      firstName: firstName || '',
      lastName: lastName || '',
      skipPasswordChecks: false,
    })

    // Add to organization
    await clerk.organizations.createOrganizationMembership({
      organizationId: orgId,
      userId: user.id,
      role: role || 'org:member',
    })

    return NextResponse.json({ success: true, userId: user.id })
  } catch (error: any) {
    console.error('POST admin/users error:', error)
    // Clerk error messages
    const msg = error?.errors?.[0]?.longMessage || error?.errors?.[0]?.message || error?.message || 'Failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// DELETE — remove a member from org
export async function DELETE(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request)
    if (isTenantError(ctx)) return ctx
    const { config } = ctx

    const orgId = config.clerkOrgId
    if (!orgId) return NextResponse.json({ error: 'No organization configured' }, { status: 400 })

    const { searchParams } = new URL(request.url)
    const memberUserId = searchParams.get('userId')
    if (!memberUserId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

    const clerk = await clerkClient()
    await clerk.organizations.deleteOrganizationMembership({
      organizationId: orgId,
      userId: memberUserId,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('DELETE admin/users error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to remove' }, { status: 500 })
  }
}
