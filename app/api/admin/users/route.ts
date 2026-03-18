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

    // Also get pending invitations
    const invitations = await clerk.organizations.getOrganizationInvitationList({
      organizationId: orgId,
      limit: 100,
    })

    const pendingInvites = invitations.data
      .filter((inv: any) => inv.status === 'pending')
      .map((inv: any) => ({
        id: inv.id,
        email: inv.emailAddress,
        role: inv.role,
        status: inv.status,
        createdAt: inv.createdAt,
      }))

    return NextResponse.json({ members, pendingInvites })
  } catch (error: any) {
    console.error('GET admin/users error:', error)
    return NextResponse.json({ error: error?.message || 'Failed' }, { status: 500 })
  }
}

// POST — invite a new user
export async function POST(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request)
    if (isTenantError(ctx)) return ctx
    const { config } = ctx

    const orgId = config.clerkOrgId
    if (!orgId) return NextResponse.json({ error: 'No organization configured' }, { status: 400 })

    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { email, role } = body
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

    const clerk = await clerkClient()
    const invitation = await clerk.organizations.createOrganizationInvitation({
      organizationId: orgId,
      emailAddress: email,
      inviterUserId: userId,
      role: role || 'org:member',
    })

    return NextResponse.json({ success: true, invitation })
  } catch (error: any) {
    console.error('POST admin/users error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to invite' }, { status: 500 })
  }
}

// DELETE — remove a member or revoke invitation
export async function DELETE(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request)
    if (isTenantError(ctx)) return ctx
    const { config } = ctx

    const orgId = config.clerkOrgId
    if (!orgId) return NextResponse.json({ error: 'No organization configured' }, { status: 400 })

    const { searchParams } = new URL(request.url)
    const memberUserId = searchParams.get('userId')
    const invitationId = searchParams.get('invitationId')

    const clerk = await clerkClient()

    if (invitationId) {
      await clerk.organizations.revokeOrganizationInvitation({
        organizationId: orgId,
        invitationId,
        requestingUserId: (await auth()).userId!,
      })
      return NextResponse.json({ success: true })
    }

    if (memberUserId) {
      await clerk.organizations.deleteOrganizationMembership({
        organizationId: orgId,
        userId: memberUserId,
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Missing userId or invitationId' }, { status: 400 })
  } catch (error: any) {
    console.error('DELETE admin/users error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to remove' }, { status: 500 })
  }
}
