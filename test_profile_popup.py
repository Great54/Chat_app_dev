#!/usr/bin/env python3
"""
Profile Popup Feature Testing for GenC Vibez
Tests new endpoints: profile-card, friends list, block/unblock, report, gifts
"""

import requests
import json
import time
from typing import Dict, Optional

# Backend URL
BASE_URL = "https://posts-profile-ui.preview.emergentagent.com/api"

# Test users
USER_A = {
    "email": "testuser_a@gencvibez.com",
    "password": "SecurePass123!",
    "username": "testuser_a",
    "displayName": "Test User A"
}

USER_B = {
    "email": "testuser_b@gencvibez.com",
    "password": "SecurePass456!",
    "username": "testuser_b",
    "displayName": "Test User B"
}

# Global test data
user_a_token = None
user_a_id = None
user_b_token = None
user_b_id = None
friend_request_id = None

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    END = '\033[0m'

def print_test(test_name: str):
    print(f"\n{Colors.BLUE}{'='*70}{Colors.END}")
    print(f"{Colors.BLUE}Testing: {test_name}{Colors.END}")
    print(f"{Colors.BLUE}{'='*70}{Colors.END}")

def print_success(message: str):
    print(f"{Colors.GREEN}✓ {message}{Colors.END}")

def print_error(message: str):
    print(f"{Colors.RED}✗ {message}{Colors.END}")

def print_warning(message: str):
    print(f"{Colors.YELLOW}⚠ {message}{Colors.END}")

def print_info(message: str):
    print(f"{Colors.CYAN}  ℹ {message}{Colors.END}")

def make_request(method: str, endpoint: str, data: Optional[Dict] = None, 
                 headers: Optional[Dict] = None, expect_error: bool = False) -> tuple:
    """Make HTTP request and return (success, response_data, status_code)"""
    url = f"{BASE_URL}{endpoint}"
    
    try:
        if method == "GET":
            response = requests.get(url, headers=headers, timeout=10)
        elif method == "POST":
            response = requests.post(url, json=data, headers=headers, timeout=10)
        elif method == "PUT":
            response = requests.put(url, json=data, headers=headers, timeout=10)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers, timeout=10)
        else:
            return False, {"error": "Invalid method"}, 0
        
        if expect_error:
            success = response.status_code >= 400
        else:
            success = 200 <= response.status_code < 300
        
        try:
            response_data = response.json()
        except:
            response_data = {"text": response.text}
        
        return success, response_data, response.status_code
    
    except requests.exceptions.RequestException as e:
        return False, {"error": str(e)}, 0

def get_auth_headers(token: str) -> Dict:
    """Get authorization headers with token"""
    return {"Authorization": f"Bearer {token}"}

# ==================== SETUP TESTS ====================

def test_register_users():
    """Register two test users"""
    global user_a_token, user_a_id, user_b_token, user_b_id
    
    print_test("Register Test Users")
    
    # Register User A
    success, data, status = make_request("POST", "/auth/register", USER_A)
    if success and "access_token" in data:
        user_a_token = data["access_token"]
        print_success(f"User A registered: {USER_A['username']}")
        
        # Get User A ID
        success2, profile, _ = make_request("GET", "/auth/me", headers=get_auth_headers(user_a_token))
        if success2:
            user_a_id = profile["id"]
            print_info(f"User A ID: {user_a_id}")
    else:
        print_error(f"Failed to register User A: {data}")
        return False
    
    # Register User B
    success, data, status = make_request("POST", "/auth/register", USER_B)
    if success and "access_token" in data:
        user_b_token = data["access_token"]
        print_success(f"User B registered: {USER_B['username']}")
        
        # Get User B ID
        success2, profile, _ = make_request("GET", "/auth/me", headers=get_auth_headers(user_b_token))
        if success2:
            user_b_id = profile["id"]
            print_info(f"User B ID: {user_b_id}")
    else:
        print_error(f"Failed to register User B: {data}")
        return False
    
    return True

# ==================== PROFILE CARD TESTS ====================

def test_profile_card_initial():
    """Test profile-card endpoint - initial state (no friendship)"""
    print_test("Profile Card - Initial State (No Friendship)")
    
    # User A fetches User B's profile
    success, data, status = make_request(
        "GET", 
        f"/users/{user_b_id}/profile-card",
        headers=get_auth_headers(user_a_token)
    )
    
    if not success:
        print_error(f"Failed to fetch profile card: {data}")
        return False
    
    # Verify response structure
    required_fields = ["id", "username", "displayName", "friendStatus", "friendCount", 
                      "isBlocked", "isSelf", "badges"]
    for field in required_fields:
        if field not in data:
            print_error(f"Missing field in response: {field}")
            return False
    
    # Verify initial state
    if data["friendStatus"] != "none":
        print_error(f"Expected friendStatus='none', got '{data['friendStatus']}'")
        return False
    
    if data["isSelf"] != False:
        print_error(f"Expected isSelf=False, got {data['isSelf']}")
        return False
    
    if data["isBlocked"] != False:
        print_error(f"Expected isBlocked=False, got {data['isBlocked']}")
        return False
    
    print_success("Profile card returned correct initial state")
    print_info(f"friendStatus: {data['friendStatus']}, isSelf: {data['isSelf']}, isBlocked: {data['isBlocked']}")
    print_info(f"friendCount: {data['friendCount']}")
    
    return True

def test_profile_card_self():
    """Test profile-card endpoint - viewing own profile"""
    print_test("Profile Card - Self View")
    
    # User A fetches their own profile
    success, data, status = make_request(
        "GET", 
        f"/users/{user_a_id}/profile-card",
        headers=get_auth_headers(user_a_token)
    )
    
    if not success:
        print_error(f"Failed to fetch own profile card: {data}")
        return False
    
    if data["isSelf"] != True:
        print_error(f"Expected isSelf=True when viewing own profile, got {data['isSelf']}")
        return False
    
    print_success("Profile card correctly identifies self view (isSelf=True)")
    
    return True

def test_friend_request_flow():
    """Test friend request flow and profile-card status changes"""
    global friend_request_id
    
    print_test("Friend Request Flow & Profile Card Status")
    
    # Step 1: User A sends friend request to User B
    print_info("Step 1: User A sends friend request to User B")
    success, data, status = make_request(
        "POST",
        "/friends/request",
        {"receiverId": user_b_id},
        headers=get_auth_headers(user_a_token)
    )
    
    if not success:
        print_error(f"Failed to send friend request: {data}")
        return False
    
    print_success("Friend request sent successfully")
    
    # Step 2: User A fetches User B's profile → should show friendStatus='sent'
    print_info("Step 2: User A checks User B's profile (should show 'sent')")
    success, data, status = make_request(
        "GET",
        f"/users/{user_b_id}/profile-card",
        headers=get_auth_headers(user_a_token)
    )
    
    if not success or data["friendStatus"] != "sent":
        print_error(f"Expected friendStatus='sent', got '{data.get('friendStatus')}'")
        return False
    
    print_success(f"User A sees friendStatus='sent' for User B")
    
    # Step 3: User B fetches User A's profile → should show friendStatus='received'
    print_info("Step 3: User B checks User A's profile (should show 'received')")
    success, data, status = make_request(
        "GET",
        f"/users/{user_a_id}/profile-card",
        headers=get_auth_headers(user_b_token)
    )
    
    if not success:
        print_error(f"Failed to fetch profile: {data}")
        return False
    
    if data["friendStatus"] != "received":
        print_error(f"Expected friendStatus='received', got '{data['friendStatus']}'")
        return False
    
    if "friendRequestId" not in data or not data["friendRequestId"]:
        print_error("Missing friendRequestId in response")
        return False
    
    friend_request_id = data["friendRequestId"]
    print_success(f"User B sees friendStatus='received' with friendRequestId: {friend_request_id}")
    
    # Step 4: User B accepts friend request
    print_info("Step 4: User B accepts friend request")
    success, data, status = make_request(
        "POST",
        f"/friends/accept/{friend_request_id}",
        headers=get_auth_headers(user_b_token)
    )
    
    if not success:
        print_error(f"Failed to accept friend request: {data}")
        return False
    
    print_success("Friend request accepted")
    
    # Step 5: Both users check profile-card → should show friendStatus='friends'
    print_info("Step 5: Verify both users see friendStatus='friends'")
    
    # User A checks User B
    success, data_a, status = make_request(
        "GET",
        f"/users/{user_b_id}/profile-card",
        headers=get_auth_headers(user_a_token)
    )
    
    # User B checks User A
    success2, data_b, status = make_request(
        "GET",
        f"/users/{user_a_id}/profile-card",
        headers=get_auth_headers(user_b_token)
    )
    
    if not success or not success2:
        print_error("Failed to fetch profile cards after acceptance")
        return False
    
    if data_a["friendStatus"] != "friends":
        print_error(f"User A: Expected friendStatus='friends', got '{data_a['friendStatus']}'")
        return False
    
    if data_b["friendStatus"] != "friends":
        print_error(f"User B: Expected friendStatus='friends', got '{data_b['friendStatus']}'")
        return False
    
    if data_a["friendCount"] < 1:
        print_error(f"User A: Expected friendCount >= 1, got {data_a['friendCount']}")
        return False
    
    if data_b["friendCount"] < 1:
        print_error(f"User B: Expected friendCount >= 1, got {data_b['friendCount']}")
        return False
    
    print_success("Both users see friendStatus='friends' and friendCount=1")
    print_info(f"User A friendCount: {data_a['friendCount']}, User B friendCount: {data_b['friendCount']}")
    
    return True

def test_get_user_friends():
    """Test GET /api/users/{user_id}/friends endpoint"""
    print_test("Get User Friends List")
    
    # User A fetches User B's friends list
    success, data, status = make_request(
        "GET",
        f"/users/{user_b_id}/friends",
        headers=get_auth_headers(user_a_token)
    )
    
    if not success:
        print_error(f"Failed to fetch friends list: {data}")
        return False
    
    if not isinstance(data, list):
        print_error(f"Expected list response, got {type(data)}")
        return False
    
    if len(data) < 1:
        print_error(f"Expected at least 1 friend, got {len(data)}")
        return False
    
    # Verify friend object structure
    friend = data[0]
    required_fields = ["id", "username", "displayName", "onlineStatus"]
    for field in required_fields:
        if field not in friend:
            print_error(f"Missing field in friend object: {field}")
            return False
    
    print_success(f"Friends list retrieved successfully ({len(data)} friends)")
    print_info(f"Friend: {friend['displayName']} (@{friend['username']})")
    
    return True

# ==================== GIFTS TESTS ====================

def test_gifts_catalog():
    """Test GET /api/gifts/catalog endpoint"""
    print_test("Gifts Catalog")
    
    success, data, status = make_request("GET", "/gifts/catalog")
    
    if not success:
        print_error(f"Failed to fetch gifts catalog: {data}")
        return False
    
    if not isinstance(data, list):
        print_error(f"Expected list response, got {type(data)}")
        return False
    
    if len(data) < 5:
        print_error(f"Expected at least 5 gifts, got {len(data)}")
        return False
    
    # Verify gift object structure
    gift = data[0]
    required_fields = ["id", "name", "icon", "price"]
    for field in required_fields:
        if field not in gift:
            print_error(f"Missing field in gift object: {field}")
            return False
    
    print_success(f"Gifts catalog retrieved successfully ({len(data)} gifts)")
    print_info(f"Sample gifts: {', '.join([g['name'] for g in data[:3]])}")
    
    return True

def test_send_gift_success():
    """Test POST /api/gifts/send - successful gift sending"""
    print_test("Send Gift - Success Case")
    
    # Get User A's current coins
    success, profile, _ = make_request("GET", "/auth/me", headers=get_auth_headers(user_a_token))
    if not success:
        print_error("Failed to get user profile")
        return False
    
    initial_coins = profile.get("coins", 0)
    print_info(f"User A initial coins: {initial_coins}")
    
    # Send rose (10 coins) from User A to User B
    success, data, status = make_request(
        "POST",
        "/gifts/send",
        {
            "receiverId": user_b_id,
            "giftId": "rose",
            "message": "Thanks for being a great friend!"
        },
        headers=get_auth_headers(user_a_token)
    )
    
    if not success:
        print_error(f"Failed to send gift: {data}")
        return False
    
    if "remainingCoins" not in data:
        print_error("Missing remainingCoins in response")
        return False
    
    expected_coins = initial_coins - 10
    if data["remainingCoins"] != expected_coins:
        print_error(f"Expected {expected_coins} coins, got {data['remainingCoins']}")
        return False
    
    print_success(f"Gift sent successfully! Coins deducted: 10 (remaining: {data['remainingCoins']})")
    
    # Verify notification was created for User B
    success, notifications, _ = make_request(
        "GET",
        "/notifications",
        headers=get_auth_headers(user_b_token)
    )
    
    if success and isinstance(notifications, list):
        gift_notif = next((n for n in notifications if n.get("type") == "gift"), None)
        if gift_notif:
            print_success(f"Notification created for receiver: {gift_notif['title']}")
        else:
            print_warning("No gift notification found (may be expected)")
    
    return True

def test_send_gift_insufficient_coins():
    """Test POST /api/gifts/send - insufficient coins"""
    print_test("Send Gift - Insufficient Coins")
    
    # Get User A's current coins
    success, profile, _ = make_request("GET", "/auth/me", headers=get_auth_headers(user_a_token))
    if not success:
        print_error("Failed to get user profile")
        return False
    
    current_coins = profile.get("coins", 0)
    print_info(f"User A current coins: {current_coins}")
    
    # Try to send diamond (250 coins) - should fail if user has < 250 coins
    success, data, status = make_request(
        "POST",
        "/gifts/send",
        {
            "receiverId": user_b_id,
            "giftId": "diamond",
            "message": "Expensive gift!"
        },
        headers=get_auth_headers(user_a_token),
        expect_error=True
    )
    
    if current_coins < 250:
        if not success or status != 400:
            print_error(f"Expected 400 error for insufficient coins, got status {status}")
            return False
        
        if "Need" not in str(data.get("detail", "")):
            print_error(f"Expected error message about needing coins, got: {data}")
            return False
        
        print_success(f"Correctly rejected gift send with insufficient coins (status 400)")
        print_info(f"Error message: {data.get('detail')}")
    else:
        print_warning(f"User has {current_coins} coins, skipping insufficient coins test")
    
    return True

def test_send_gift_to_self():
    """Test POST /api/gifts/send - cannot send to self"""
    print_test("Send Gift - Cannot Send to Self")
    
    success, data, status = make_request(
        "POST",
        "/gifts/send",
        {
            "receiverId": user_a_id,
            "giftId": "rose"
        },
        headers=get_auth_headers(user_a_token),
        expect_error=True
    )
    
    if not success or status != 400:
        print_error(f"Expected 400 error when sending gift to self, got status {status}")
        return False
    
    if "yourself" not in str(data.get("detail", "")).lower():
        print_error(f"Expected error about sending to self, got: {data}")
        return False
    
    print_success("Correctly rejected gift send to self (status 400)")
    print_info(f"Error message: {data.get('detail')}")
    
    return True

# ==================== BLOCK/UNBLOCK TESTS ====================

def test_block_user():
    """Test POST /api/users/{user_id}/block"""
    print_test("Block User")
    
    # User A blocks User B
    success, data, status = make_request(
        "POST",
        f"/users/{user_b_id}/block",
        headers=get_auth_headers(user_a_token)
    )
    
    if not success:
        print_error(f"Failed to block user: {data}")
        return False
    
    if data.get("isBlocked") != True:
        print_error(f"Expected isBlocked=True, got {data.get('isBlocked')}")
        return False
    
    print_success("User blocked successfully")
    
    # Verify profile-card shows isBlocked=True
    success, profile, _ = make_request(
        "GET",
        f"/users/{user_b_id}/profile-card",
        headers=get_auth_headers(user_a_token)
    )
    
    if not success:
        print_error("Failed to fetch profile card after blocking")
        return False
    
    if profile.get("isBlocked") != True:
        print_error(f"Profile card should show isBlocked=True, got {profile.get('isBlocked')}")
        return False
    
    print_success("Profile card correctly shows isBlocked=True")
    
    # Verify friendship was removed
    if profile.get("friendStatus") != "none":
        print_error(f"Expected friendStatus='none' after block, got '{profile.get('friendStatus')}'")
        return False
    
    print_success("Friendship removed after blocking (friendStatus='none')")
    
    return True

def test_unblock_user():
    """Test DELETE /api/users/{user_id}/block"""
    print_test("Unblock User")
    
    # User A unblocks User B
    success, data, status = make_request(
        "DELETE",
        f"/users/{user_b_id}/block",
        headers=get_auth_headers(user_a_token)
    )
    
    if not success:
        print_error(f"Failed to unblock user: {data}")
        return False
    
    if data.get("isBlocked") != False:
        print_error(f"Expected isBlocked=False, got {data.get('isBlocked')}")
        return False
    
    print_success("User unblocked successfully")
    
    # Verify profile-card shows isBlocked=False
    success, profile, _ = make_request(
        "GET",
        f"/users/{user_b_id}/profile-card",
        headers=get_auth_headers(user_a_token)
    )
    
    if not success:
        print_error("Failed to fetch profile card after unblocking")
        return False
    
    if profile.get("isBlocked") != False:
        print_error(f"Profile card should show isBlocked=False, got {profile.get('isBlocked')}")
        return False
    
    print_success("Profile card correctly shows isBlocked=False")
    
    return True

# ==================== REPORT TESTS ====================

def test_report_user():
    """Test POST /api/users/{user_id}/report"""
    print_test("Report User")
    
    # User A reports User B
    success, data, status = make_request(
        "POST",
        f"/users/{user_b_id}/report",
        {
            "reason": "spam",
            "details": "Sending unwanted messages repeatedly"
        },
        headers=get_auth_headers(user_a_token)
    )
    
    if not success:
        print_error(f"Failed to report user: {data}")
        return False
    
    if "message" not in data:
        print_error("Missing confirmation message in response")
        return False
    
    print_success("User reported successfully")
    print_info(f"Response: {data['message']}")
    
    return True

def test_report_self():
    """Test POST /api/users/{user_id}/report - cannot report self"""
    print_test("Report User - Cannot Report Self")
    
    success, data, status = make_request(
        "POST",
        f"/users/{user_a_id}/report",
        {
            "reason": "test"
        },
        headers=get_auth_headers(user_a_token),
        expect_error=True
    )
    
    if not success or status != 400:
        print_error(f"Expected 400 error when reporting self, got status {status}")
        return False
    
    if "yourself" not in str(data.get("detail", "")).lower():
        print_error(f"Expected error about reporting self, got: {data}")
        return False
    
    print_success("Correctly rejected self-report (status 400)")
    print_info(f"Error message: {data.get('detail')}")
    
    return True

# ==================== MAIN TEST RUNNER ====================

def run_all_tests():
    """Run all profile popup feature tests"""
    print(f"\n{Colors.CYAN}{'='*70}")
    print("GenC Vibez - Profile Popup Feature Testing")
    print(f"{'='*70}{Colors.END}\n")
    
    tests = [
        ("Setup: Register Users", test_register_users),
        ("Profile Card: Initial State", test_profile_card_initial),
        ("Profile Card: Self View", test_profile_card_self),
        ("Friend Request Flow", test_friend_request_flow),
        ("Get User Friends", test_get_user_friends),
        ("Gifts: Catalog", test_gifts_catalog),
        ("Gifts: Send Success", test_send_gift_success),
        ("Gifts: Insufficient Coins", test_send_gift_insufficient_coins),
        ("Gifts: Cannot Send to Self", test_send_gift_to_self),
        ("Block User", test_block_user),
        ("Unblock User", test_unblock_user),
        ("Report User", test_report_user),
        ("Report: Cannot Report Self", test_report_self),
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            if result:
                passed += 1
            else:
                failed += 1
                print_error(f"Test failed: {test_name}")
        except Exception as e:
            failed += 1
            print_error(f"Test crashed: {test_name}")
            print_error(f"Error: {str(e)}")
    
    # Print summary
    print(f"\n{Colors.CYAN}{'='*70}")
    print("TEST SUMMARY")
    print(f"{'='*70}{Colors.END}")
    print(f"{Colors.GREEN}Passed: {passed}{Colors.END}")
    print(f"{Colors.RED}Failed: {failed}{Colors.END}")
    print(f"Total: {passed + failed}")
    
    if failed == 0:
        print(f"\n{Colors.GREEN}{'='*70}")
        print("🎉 ALL TESTS PASSED! 🎉")
        print(f"{'='*70}{Colors.END}\n")
    else:
        print(f"\n{Colors.RED}{'='*70}")
        print(f"❌ {failed} TEST(S) FAILED")
        print(f"{'='*70}{Colors.END}\n")
    
    return failed == 0

if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)
