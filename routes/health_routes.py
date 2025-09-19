"""
健康检查路由
提供系统健康状态的API端点
"""

from flask import Blueprint, jsonify, request
from services.health_check_service import health_service

# 创建健康检查蓝图
health_bp = Blueprint('health', __name__, url_prefix='/health')


@health_bp.route('/', methods=['GET'])
def health_check():
    """
    整体健康检查端点
    返回系统整体健康状态
    """
    try:
        health_data = health_service.get_overall_health()
        
        # 根据健康状态设置HTTP状态码
        if health_data['status'] == 'healthy':
            status_code = 200
        elif health_data['status'] == 'degraded':
            status_code = 200  # 降级但仍可用
        else:
            status_code = 503  # 服务不可用
        
        return jsonify(health_data), status_code
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'健康检查失败: {str(e)}',
            'timestamp': health_service.get_current_timestamp()
        }), 500


@health_bp.route('/ready', methods=['GET'])
def readiness_check():
    """
    就绪检查端点（Kubernetes Readiness Probe）
    检查应用是否准备好接收流量
    """
    try:
        readiness_data = health_service.get_readiness_status()
        
        status_code = 200 if readiness_data['ready'] else 503
        
        return jsonify(readiness_data), status_code
        
    except Exception as e:
        return jsonify({
            'ready': False,
            'error': str(e),
            'timestamp': health_service.get_current_timestamp()
        }), 503


@health_bp.route('/live', methods=['GET'])
def liveness_check():
    """
    存活检查端点（Kubernetes Liveness Probe）
    检查应用进程是否存活
    """
    try:
        liveness_data = health_service.get_liveness_status()
        
        status_code = 200 if liveness_data['alive'] else 503
        
        return jsonify(liveness_data), status_code
        
    except Exception as e:
        return jsonify({
            'alive': False,
            'error': str(e),
            'timestamp': health_service.get_current_timestamp()
        }), 503


@health_bp.route('/components', methods=['GET'])
def components_health():
    """
    组件健康状态端点
    返回所有组件的详细健康信息
    """
    try:
        health_data = health_service.get_overall_health()
        
        return jsonify({
            'components': health_data['components'],
            'timestamp': health_data['timestamp']
        }), 200
        
    except Exception as e:
        return jsonify({
            'error': f'获取组件状态失败: {str(e)}',
            'timestamp': health_service.get_current_timestamp()
        }), 500


@health_bp.route('/components/<component_name>', methods=['GET'])
def component_health(component_name):
    """
    单个组件健康状态端点
    返回指定组件的健康信息
    """
    try:
        component_data = health_service.get_component_health(component_name)
        
        if component_data is None:
            return jsonify({
                'error': f'组件不存在: {component_name}',
                'available_components': list(health_service.components.keys())
            }), 404
        
        return jsonify(component_data), 200
        
    except Exception as e:
        return jsonify({
            'error': f'获取组件状态失败: {str(e)}',
            'timestamp': health_service.get_current_timestamp()
        }), 500


@health_bp.route('/metrics', methods=['GET'])
def system_metrics():
    """
    系统指标端点
    返回系统性能指标
    """
    try:
        metrics_data = health_service.get_metrics()
        
        return jsonify(metrics_data), 200
        
    except Exception as e:
        return jsonify({
            'error': f'获取系统指标失败: {str(e)}',
            'timestamp': health_service.get_current_timestamp()
        }), 500


@health_bp.route('/check', methods=['POST'])
def force_health_check():
    """
    强制健康检查端点
    立即执行健康检查
    """
    try:
        component_name = request.json.get('component') if request.is_json else None
        
        # 执行强制检查
        health_service.force_check(component_name)
        
        # 返回更新后的状态
        if component_name:
            result = health_service.get_component_health(component_name)
            if result is None:
                return jsonify({
                    'error': f'组件不存在: {component_name}'
                }), 404
        else:
            result = health_service.get_overall_health()
        
        return jsonify({
            'message': '健康检查已执行',
            'result': result
        }), 200
        
    except ValueError as e:
        return jsonify({
            'error': str(e)
        }), 400
    except Exception as e:
        return jsonify({
            'error': f'强制检查失败: {str(e)}'
        }), 500


@health_bp.route('/thresholds', methods=['GET'])
def get_thresholds():
    """
    获取健康检查阈值
    """
    try:
        thresholds = health_service.get_thresholds()
        
        return jsonify({
            'thresholds': thresholds,
            'timestamp': health_service.get_current_timestamp()
        }), 200
        
    except Exception as e:
        return jsonify({
            'error': f'获取阈值失败: {str(e)}'
        }), 500


@health_bp.route('/thresholds', methods=['PUT'])
def update_thresholds():
    """
    更新健康检查阈值
    """
    try:
        if not request.is_json:
            return jsonify({
                'error': '请求必须是JSON格式'
            }), 400
        
        data = request.get_json()
        updated_thresholds = {}
        
        for metric, value in data.items():
            try:
                health_service.set_threshold(metric, float(value))
                updated_thresholds[metric] = float(value)
            except ValueError as e:
                return jsonify({
                    'error': f'阈值设置失败: {str(e)}'
                }), 400
        
        return jsonify({
            'message': '阈值已更新',
            'updated_thresholds': updated_thresholds,
            'current_thresholds': health_service.get_thresholds()
        }), 200
        
    except Exception as e:
        return jsonify({
            'error': f'更新阈值失败: {str(e)}'
        }), 500


@health_bp.route('/reset', methods=['POST'])
def reset_component():
    """
    重置组件状态
    """
    try:
        if not request.is_json:
            return jsonify({
                'error': '请求必须是JSON格式'
            }), 400
        
        data = request.get_json()
        component_name = data.get('component')
        
        if not component_name:
            return jsonify({
                'error': '缺少组件名称'
            }), 400
        
        if component_name not in health_service.components:
            return jsonify({
                'error': f'组件不存在: {component_name}',
                'available_components': list(health_service.components.keys())
            }), 404
        
        health_service.reset_component_status(component_name)
        
        return jsonify({
            'message': f'组件状态已重置: {component_name}',
            'component': health_service.get_component_health(component_name)
        }), 200
        
    except Exception as e:
        return jsonify({
            'error': f'重置组件状态失败: {str(e)}'
        }), 500


@health_bp.route('/monitoring/start', methods=['POST'])
def start_monitoring():
    """
    启动健康监控
    """
    try:
        health_service.start_monitoring()
        
        return jsonify({
            'message': '健康监控已启动',
            'monitoring': health_service.is_monitoring
        }), 200
        
    except Exception as e:
        return jsonify({
            'error': f'启动监控失败: {str(e)}'
        }), 500


@health_bp.route('/monitoring/stop', methods=['POST'])
def stop_monitoring():
    """
    停止健康监控
    """
    try:
        health_service.stop_monitoring()
        
        return jsonify({
            'message': '健康监控已停止',
            'monitoring': health_service.is_monitoring
        }), 200
        
    except Exception as e:
        return jsonify({
            'error': f'停止监控失败: {str(e)}'
        }), 500


@health_bp.route('/monitoring/status', methods=['GET'])
def monitoring_status():
    """
    获取监控状态
    """
    try:
        return jsonify({
            'monitoring': health_service.is_monitoring,
            'check_interval': health_service.check_interval,
            'timestamp': health_service.get_current_timestamp()
        }), 200
        
    except Exception as e:
        return jsonify({
            'error': f'获取监控状态失败: {str(e)}'
        }), 500


# 添加辅助方法到健康服务
def get_current_timestamp():
    """获取当前时间戳"""
    from datetime import datetime
    return datetime.now().isoformat()

# 将方法添加到健康服务实例
health_service.get_current_timestamp = get_current_timestamp