#!/usr/bin/env python3
"""
Comprehensive Feed System Test for GenC Vibez
Tests all feed endpoints and activity creation hooks
"""

import requests
import json
from datetime import datetime
import time

BASE_URL = "http://localhost:8001/api"

# Test results tracking
test_results = []

def log_test(test_name, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    test_results.append({"test": test_name, "passed": passed, "details": details})
    print(f"{status}: {test_name}")
    if details:
        print(f"   Details: {details}")

def register_user(email, password, username, display_name):
    """Register a new user"""
    try:
        response = requests.post(f"{BASE_URL}/auth/register", json={
            "email": email,
            "password": password,
            "username": username,
            "displayName": display_name
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token")
        elif response.status_code == 400 and "already" in response.text.lower():
            # User exists, try login with username
            return login_user(username, password)
        else:
            print(f"Registration failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"Registration error: {e}")
        return None

def login_user(identifier, password):
    """Login existing user"""
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json={
            "identifier": identifier,
            "password": password
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token")
        else:
            print(f"Login failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"Login error: {e}")
        return None

def get_user_profile(token):
    """Get current user profile"""
    try:
        response = requests.get(f"{BASE_URL}/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        print(f"Get profile error: {e}")
        return None

def send_friend_request(token, receiver_id):
    """Send friend request"""
    try:
        response = requests.post(f"{BASE_URL}/friends/request", 
            headers={"Authorization": f"Bearer {token}"},
            json={"receiverId": receiver_id}
        )
        return response
    except Exception as e:
        print(f"Send friend request error: {e}")
        return None

def get_friend_requests(token):
    """Get pending friend requests"""
    try:
        response = requests.get(f"{BASE_URL}/friends/pending",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code == 200:
            return response.json()
        return []
    except Exception as e:
        print(f"Get friend requests error: {e}")
        return []

def accept_friend_request(token, request_id):
    """Accept friend request"""
    try:
        response = requests.post(f"{BASE_URL}/friends/accept/{request_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        return response
    except Exception as e:
        print(f"Accept friend request error: {e}")
        return None

def send_gift(token, receiver_id, gift_id):
    """Send a gift"""
    try:
        response = requests.post(f"{BASE_URL}/gifts/send",
            headers={"Authorization": f"Bearer {token}"},
            json={"receiverId": receiver_id, "giftId": gift_id}
        )
        return response
    except Exception as e:
        print(f"Send gift error: {e}")
        return None

def purchase_vip(token, tier):
    """Purchase VIP tier"""
    try:
        response = requests.post(f"{BASE_URL}/vip/purchase",
            headers={"Authorization": f"Bearer {token}"},
            json={"tier": tier}
        )
        return response
    except Exception as e:
        print(f"Purchase VIP error: {e}")
        return None

def claim_daily_reward(token):
    """Claim daily reward"""
    try:
        response = requests.post(f"{BASE_URL}/coins/daily-reward",
            headers={"Authorization": f"Bearer {token}"}
        )
        return response
    except Exception as e:
        print(f"Claim daily reward error: {e}")
        return None

def get_feed(token, limit=30, before=None):
    """Get feed items"""
    try:
        url = f"{BASE_URL}/feed?limit={limit}"
        if before:
            url += f"&before={before}"
        response = requests.get(url, headers={"Authorization": f"Bearer {token}"})
        return response
    except Exception as e:
        print(f"Get feed error: {e}")
        return None

def get_unread_count(token):
    """Get unread feed count"""
    try:
        response = requests.get(f"{BASE_URL}/feed/unread-count",
            headers={"Authorization": f"Bearer {token}"}
        )
        return response
    except Exception as e:
        print(f"Get unread count error: {e}")
        return None

def mark_feed_seen(token):
    """Mark feed as seen"""
    try:
        response = requests.post(f"{BASE_URL}/feed/mark-seen",
            headers={"Authorization": f"Bearer {token}"}
        )
        return response
    except Exception as e:
        print(f"Mark feed seen error: {e}")
        return None

def main():
    print("=" * 80)
    print("FEED SYSTEM COMPREHENSIVE TEST")
    print("=" * 80)
    print()

    # Step 1: Register/Login 3 users
    print("Step 1: Setting up 3 test users (A, B, C)")
    print("-" * 80)
    
    user_a_token = register_user(
        "feed_test_user_a@gencvibez.com",
        "SecurePass123!",
        "feed_test_a",
        "Feed Test User A"
    )
    
    user_b_token = register_user(
        "feed_test_user_b@gencvibez.com",
        "SecurePass456!",
        "feed_test_b",
        "Feed Test User B"
    )
    
    user_c_token = register_user(
        "feed_test_user_c@gencvibez.com",
        "SecurePass789!",
        "feed_test_c",
        "Feed Test User C"
    )
    
    if not all([user_a_token, user_b_token, user_c_token]):
        print("❌ CRITICAL: Failed to setup test users")
        return
    
    log_test("User Registration/Login", True, "All 3 users (A, B, C) ready")
    
    # Get user profiles
    user_a = get_user_profile(user_a_token)
    user_b = get_user_profile(user_b_token)
    user_c = get_user_profile(user_c_token)
    
    user_a_id = user_a["id"]
    user_b_id = user_b["id"]
    user_c_id = user_c["id"]
    
    print(f"User A ID: {user_a_id}")
    print(f"User B ID: {user_b_id}")
    print(f"User C ID: {user_c_id}")
    print()

    # Step 2: Make A and B friends
    print("Step 2: Making User A and User B friends")
    print("-" * 80)
    
    # A sends friend request to B
    req_resp = send_friend_request(user_a_token, user_b_id)
    if req_resp and req_resp.status_code == 200:
        log_test("A sends friend request to B", True)
    else:
        log_test("A sends friend request to B", False, 
                f"Status: {req_resp.status_code if req_resp else 'None'}")
    
    time.sleep(0.5)  # Small delay for DB consistency
    
    # B gets friend requests
    b_requests = get_friend_requests(user_b_token)
    if b_requests and len(b_requests) > 0:
        request_id = b_requests[0]["requestId"]
        log_test("B receives friend request", True, f"Request ID: {request_id}")
        
        # B accepts the request
        accept_resp = accept_friend_request(user_b_token, request_id)
        if accept_resp and accept_resp.status_code == 200:
            log_test("B accepts friend request", True)
        else:
            log_test("B accepts friend request", False,
                    f"Status: {accept_resp.status_code if accept_resp else 'None'}")
    else:
        log_test("B receives friend request", False, "No requests found")
    
    time.sleep(0.5)
    
    # Verify friend_added activities in both feeds
    a_feed_resp = get_feed(user_a_token)
    b_feed_resp = get_feed(user_b_token)
    
    if a_feed_resp and a_feed_resp.status_code == 200:
        a_feed = a_feed_resp.json()
        friend_added_in_a = any(item["type"] == "friend_added" for item in a_feed)
        log_test("friend_added activity in A's feed", friend_added_in_a,
                f"Found {len(a_feed)} items, friend_added: {friend_added_in_a}")
    else:
        log_test("Get A's feed", False, f"Status: {a_feed_resp.status_code if a_feed_resp else 'None'}")
    
    if b_feed_resp and b_feed_resp.status_code == 200:
        b_feed = b_feed_resp.json()
        friend_added_in_b = any(item["type"] == "friend_added" for item in b_feed)
        log_test("friend_added activity in B's feed", friend_added_in_b,
                f"Found {len(b_feed)} items, friend_added: {friend_added_in_b}")
    else:
        log_test("Get B's feed", False, f"Status: {b_feed_resp.status_code if b_feed_resp else 'None'}")
    
    print()

    # Step 3: Make A and C friends
    print("Step 3: Making User A and User C friends")
    print("-" * 80)
    
    req_resp = send_friend_request(user_a_token, user_c_id)
    if req_resp and req_resp.status_code == 200:
        log_test("A sends friend request to C", True)
    else:
        log_test("A sends friend request to C", False,
                f"Status: {req_resp.status_code if req_resp else 'None'}")
    
    time.sleep(0.5)
    
    c_requests = get_friend_requests(user_c_token)
    if c_requests and len(c_requests) > 0:
        request_id = c_requests[0]["requestId"]
        log_test("C receives friend request", True)
        
        accept_resp = accept_friend_request(user_c_token, request_id)
        if accept_resp and accept_resp.status_code == 200:
            log_test("C accepts friend request", True)
        else:
            log_test("C accepts friend request", False)
    else:
        log_test("C receives friend request", False)
    
    time.sleep(0.5)
    print()

    # Step 4: A sends gift to B
    print("Step 4: User A sends gift to User B")
    print("-" * 80)
    
    # Check A's coins first
    user_a_updated = get_user_profile(user_a_token)
    a_coins_before = user_a_updated.get("coins", 0)
    print(f"User A coins before gift: {a_coins_before}")
    
    # Send a rose (price=10)
    gift_resp = send_gift(user_a_token, user_b_id, "rose")
    if gift_resp and gift_resp.status_code == 200:
        log_test("A sends gift (rose) to B", True)
        
        time.sleep(0.5)
        
        # Check A's feed for gift_sent (audience=self)
        a_feed_resp = get_feed(user_a_token)
        if a_feed_resp and a_feed_resp.status_code == 200:
            a_feed = a_feed_resp.json()
            gift_sent_items = [item for item in a_feed if item["type"] == "gift_sent"]
            if gift_sent_items:
                gift_sent = gift_sent_items[0]
                is_self_audience = gift_sent["audience"] == "self"
                is_own = gift_sent["isOwn"]
                log_test("gift_sent in A's feed (audience=self)", 
                        is_self_audience and is_own,
                        f"audience={gift_sent['audience']}, isOwn={is_own}")
            else:
                log_test("gift_sent in A's feed", False, "No gift_sent activity found")
        
        # Check B's feed for gift_received (audience=friends)
        b_feed_resp = get_feed(user_b_token)
        if b_feed_resp and b_feed_resp.status_code == 200:
            b_feed = b_feed_resp.json()
            gift_received_items = [item for item in b_feed if item["type"] == "gift_received"]
            if gift_received_items:
                gift_received = gift_received_items[0]
                is_friends_audience = gift_received["audience"] == "friends"
                has_actor = gift_received["actor"] is not None
                actor_is_a = gift_received["actor"]["id"] == user_a_id if has_actor else False
                log_test("gift_received in B's feed (audience=friends)",
                        is_friends_audience and has_actor and actor_is_a,
                        f"audience={gift_received['audience']}, actor={gift_received['actor']['id'] if has_actor else None}")
            else:
                log_test("gift_received in B's feed", False, "No gift_received activity found")
        
        # Check A's feed - should see B's gift_received since they're friends
        a_feed_resp = get_feed(user_a_token)
        if a_feed_resp and a_feed_resp.status_code == 200:
            a_feed = a_feed_resp.json()
            # A should see B's gift_received (userId=B, audience=friends, A is friend of B)
            b_gift_received_in_a_feed = any(
                item["type"] == "gift_received" and 
                item["user"]["id"] == user_b_id and 
                item["audience"] == "friends"
                for item in a_feed
            )
            log_test("A sees B's gift_received (friend's activity)",
                    b_gift_received_in_a_feed,
                    f"A should see B's gift_received since they're friends")
        
        # Check C's feed - should NOT see B's gift_received (C is not friends with B)
        c_feed_resp = get_feed(user_c_token)
        if c_feed_resp and c_feed_resp.status_code == 200:
            c_feed = c_feed_resp.json()
            b_gift_received_in_c_feed = any(
                item["type"] == "gift_received" and 
                item["user"]["id"] == user_b_id
                for item in c_feed
            )
            log_test("C does NOT see B's gift_received (not friends)",
                    not b_gift_received_in_c_feed,
                    f"C should NOT see B's gift_received (not friends with B)")
            
            # C should also NOT see A's gift_sent (audience=self)
            a_gift_sent_in_c_feed = any(
                item["type"] == "gift_sent" and 
                item["user"]["id"] == user_a_id
                for item in c_feed
            )
            log_test("C does NOT see A's gift_sent (audience=self)",
                    not a_gift_sent_in_c_feed,
                    f"C should NOT see A's gift_sent (audience=self)")
    else:
        log_test("A sends gift to B", False,
                f"Status: {gift_resp.status_code if gift_resp else 'None'}, "
                f"Response: {gift_resp.text if gift_resp else 'None'}")
    
    print()

    # Step 5: B purchases VIP
    print("Step 5: User B purchases VIP (Pro tier)")
    print("-" * 80)
    
    # Check B's coins
    user_b_updated = get_user_profile(user_b_token)
    b_coins = user_b_updated.get("coins", 0)
    print(f"User B coins: {b_coins}")
    
    # VIP Pro costs 500 coins - B needs more coins
    # Let's give B enough coins by claiming daily reward multiple times or just test with available coins
    # For now, let's check if B has enough, if not, we'll note it
    
    if b_coins < 500:
        print(f"⚠️  User B has insufficient coins ({b_coins}) for VIP Pro (500 coins)")
        print("Skipping VIP purchase test - would need to add more coins first")
        log_test("B purchases VIP", False, f"Insufficient coins: {b_coins} < 500")
    else:
        vip_resp = purchase_vip(user_b_token, "pro")
        if vip_resp and vip_resp.status_code == 200:
            log_test("B purchases VIP Pro", True)
            
            time.sleep(0.5)
            
            # Check B's feed for vip_purchased
            b_feed_resp = get_feed(user_b_token)
            if b_feed_resp and b_feed_resp.status_code == 200:
                b_feed = b_feed_resp.json()
                vip_purchased = any(item["type"] == "vip_purchased" for item in b_feed)
                log_test("vip_purchased in B's feed", vip_purchased)
            
            # Check A's feed - should see B's vip_purchased (friends)
            a_feed_resp = get_feed(user_a_token)
            if a_feed_resp and a_feed_resp.status_code == 200:
                a_feed = a_feed_resp.json()
                b_vip_in_a_feed = any(
                    item["type"] == "vip_purchased" and 
                    item["user"]["id"] == user_b_id
                    for item in a_feed
                )
                log_test("A sees B's vip_purchased (friend's activity)", b_vip_in_a_feed)
            
            # Check C's feed - should NOT see B's vip_purchased (not friends)
            c_feed_resp = get_feed(user_c_token)
            if c_feed_resp and c_feed_resp.status_code == 200:
                c_feed = c_feed_resp.json()
                b_vip_in_c_feed = any(
                    item["type"] == "vip_purchased" and 
                    item["user"]["id"] == user_b_id
                    for item in c_feed
                )
                log_test("C does NOT see B's vip_purchased (not friends)", not b_vip_in_c_feed)
        else:
            log_test("B purchases VIP", False,
                    f"Status: {vip_resp.status_code if vip_resp else 'None'}")
    
    print()

    # Step 6: Test unread count and mark-seen
    print("Step 6: Testing unread count and mark-seen")
    print("-" * 80)
    
    # Get A's unread count (should have activities from B and C)
    unread_resp = get_unread_count(user_a_token)
    if unread_resp and unread_resp.status_code == 200:
        unread_data = unread_resp.json()
        unread_count = unread_data.get("count", 0)
        log_test("Get unread count", True, f"Unread count: {unread_count}")
        
        # Mark as seen
        mark_resp = mark_feed_seen(user_a_token)
        if mark_resp and mark_resp.status_code == 200:
            log_test("Mark feed as seen", True)
            
            time.sleep(0.5)
            
            # Check unread count again - should be 0
            unread_resp2 = get_unread_count(user_a_token)
            if unread_resp2 and unread_resp2.status_code == 200:
                unread_data2 = unread_resp2.json()
                new_count = unread_data2.get("count", 0)
                log_test("Unread count after mark-seen", new_count == 0,
                        f"Count: {new_count} (expected 0)")
            else:
                log_test("Get unread count after mark-seen", False)
        else:
            log_test("Mark feed as seen", False)
    else:
        log_test("Get unread count", False)
    
    print()

    # Step 7: Test pagination
    print("Step 7: Testing pagination with before parameter")
    print("-" * 80)
    
    # Get first page
    feed_resp = get_feed(user_a_token, limit=2)
    if feed_resp and feed_resp.status_code == 200:
        feed_page1 = feed_resp.json()
        log_test("Get feed with limit=2", len(feed_page1) <= 2,
                f"Got {len(feed_page1)} items")
        
        if len(feed_page1) > 0:
            # Get second page using before parameter
            last_item_time = feed_page1[-1]["createdAt"]
            feed_resp2 = get_feed(user_a_token, limit=2, before=last_item_time)
            if feed_resp2 and feed_resp2.status_code == 200:
                feed_page2 = feed_resp2.json()
                log_test("Pagination with before parameter", True,
                        f"Page 2 has {len(feed_page2)} items")
                
                # Verify items are older
                if len(feed_page2) > 0:
                    page1_time = datetime.fromisoformat(feed_page1[-1]["createdAt"].replace("Z", ""))
                    page2_time = datetime.fromisoformat(feed_page2[0]["createdAt"].replace("Z", ""))
                    is_older = page2_time < page1_time
                    log_test("Pagination returns older items", is_older,
                            f"Page 2 items are {'older' if is_older else 'newer'}")
            else:
                log_test("Pagination with before parameter", False)
    else:
        log_test("Get feed for pagination test", False)
    
    print()

    # Step 8: Test auth protection
    print("Step 8: Testing authentication protection")
    print("-" * 80)
    
    # Try to get feed without token
    try:
        no_auth_resp = requests.get(f"{BASE_URL}/feed")
        is_protected = no_auth_resp.status_code in [401, 403]
        log_test("Feed endpoint requires auth", is_protected,
                f"Status without auth: {no_auth_resp.status_code}")
    except Exception as e:
        log_test("Feed endpoint auth test", False, str(e))
    
    # Try unread-count without token
    try:
        no_auth_resp = requests.get(f"{BASE_URL}/feed/unread-count")
        is_protected = no_auth_resp.status_code in [401, 403]
        log_test("Unread-count endpoint requires auth", is_protected,
                f"Status without auth: {no_auth_resp.status_code}")
    except Exception as e:
        log_test("Unread-count endpoint auth test", False, str(e))
    
    # Try mark-seen without token
    try:
        no_auth_resp = requests.post(f"{BASE_URL}/feed/mark-seen")
        is_protected = no_auth_resp.status_code in [401, 403]
        log_test("Mark-seen endpoint requires auth", is_protected,
                f"Status without auth: {no_auth_resp.status_code}")
    except Exception as e:
        log_test("Mark-seen endpoint auth test", False, str(e))
    
    print()

    # Step 9: Test sorting (newest first)
    print("Step 9: Testing feed sorting (newest first)")
    print("-" * 80)
    
    feed_resp = get_feed(user_a_token, limit=10)
    if feed_resp and feed_resp.status_code == 200:
        feed = feed_resp.json()
        if len(feed) >= 2:
            is_sorted = True
            for i in range(len(feed) - 1):
                time1 = datetime.fromisoformat(feed[i]["createdAt"].replace("Z", ""))
                time2 = datetime.fromisoformat(feed[i+1]["createdAt"].replace("Z", ""))
                if time1 < time2:
                    is_sorted = False
                    break
            log_test("Feed items sorted newest first", is_sorted,
                    f"Checked {len(feed)} items")
        else:
            log_test("Feed sorting test", True, "Not enough items to verify sorting")
    else:
        log_test("Feed sorting test", False)
    
    print()

    # Summary
    print("=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for t in test_results if t["passed"])
    total = len(test_results)
    
    print(f"\nTotal Tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    print(f"Success Rate: {(passed/total*100):.1f}%\n")
    
    if total - passed > 0:
        print("Failed Tests:")
        for t in test_results:
            if not t["passed"]:
                print(f"  ❌ {t['test']}")
                if t["details"]:
                    print(f"     {t['details']}")
    
    print("\n" + "=" * 80)
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
